import { useEffect, useState, type CSSProperties } from "react";
import { Basket, Check, ClockCounterClockwise } from "@phosphor-icons/react";
import { getLastListSlug } from "../lib/lastList";
import type { DraftItem } from "../../shared/types";

const FINALIZING_TEXT = "பட்டியலை உருவாக்குகிறேன்…";

// Same fun palette used for the loader dots, confetti, and category colors
// elsewhere - cycling through it here (by each line's own fixed position,
// not randomly) ties the notes feed back into the same visual identity
// instead of introducing a new one.
const NOTES_COLORS = [
	"var(--color-fun-coral)",
	"var(--color-fun-gold)",
	"var(--color-fun-sage)",
	"var(--color-fun-blue)",
	"var(--color-fun-berry)",
	"var(--color-fun-violet)",
];

// Teleprompter feel: the newest line is big, bold, and vivid; each older
// line shrinks and fades a bit more, receding rather than just stacking
// uniformly - `distance` is how many lines back from the newest this is.
function noteLineStyle(originalIndex: number, distance: number): CSSProperties {
	return {
		"--line-color": NOTES_COLORS[originalIndex % NOTES_COLORS.length],
		"--line-size": `${Math.max(0.8, 1.3 - distance * 0.14)}rem`,
		"--line-opacity": Math.max(0.35, 1 - distance * 0.22),
		"--line-weight": distance === 0 ? 800 : distance === 1 ? 650 : 550,
	} as CSSProperties;
}

type Props = {
	items: DraftItem[];
	segments: string[];
	isFinalized: boolean;
	onFinalize: () => Promise<{ slug: string }>;
	onQuickAdd: (text: string) => void;
};

type FrequentItem = { name: string; quantity: string };

export function LiveList({ items, segments, isFinalized, onFinalize, onQuickAdd }: Props) {
	const [finalizing, setFinalizing] = useState(false);
	const [frequentItems, setFrequentItems] = useState<FrequentItem[]>([]);
	const [lastListSlug] = useState(getLastListSlug);

	useEffect(() => {
		fetch("/api/frequent-items")
			.then((res) => res.json() as Promise<{ items: FrequentItem[] }>)
			.then((data) => setFrequentItems(data.items))
			.catch(() => {
				// Not critical - the empty state just won't show quick-add chips.
			});
	}, []);

	async function handleDone() {
		setFinalizing(true);
		try {
			await onFinalize();
		} finally {
			setFinalizing(false);
		}
	}

	return (
		<div className="list-pane">
			{items.length === 0 && segments.length === 0 && (
				<div className="empty-state">
					<Basket weight="duotone" size={56} />
					<p>பேசும்போது உங்கள் வார்த்தைகள் இங்கே தோன்றும்.</p>
					{frequentItems.length > 0 && (
						<div className="quick-add-chips">
							{frequentItems.map((item) => (
								<button
									key={item.name}
									className="quick-add-chip"
									onClick={() => onQuickAdd(`${item.name} ${item.quantity} வேணும்.`)}
								>
									{item.name}
								</button>
							))}
						</div>
					)}
					{lastListSlug && (
						// No target="_blank" - a detached window has no back-stack in the installed PWA.
						<a className="last-list-link" href={`/list/${lastListSlug}`}>
							<ClockCounterClockwise weight="bold" size={14} />
							கடைசி பட்டியலைப் பார்
						</a>
					)}
				</div>
			)}

			{/* Raw, unprocessed segments - deliberately not styled like list items,
			    so a rough or partial line doesn't read as broken. The real list only
			    exists after Done runs the one actual extraction pass. */}
			{items.length === 0 && segments.length > 0 && (
				<div className="notes-feed">
					{[...segments].reverse().map((segment, distance) => {
						const originalIndex = segments.length - 1 - distance;
						return (
							<p key={originalIndex} className="notes-line" style={noteLineStyle(originalIndex, distance)}>
								{segment}
							</p>
						);
					})}
				</div>
			)}

			{items.length > 0 && (
				<ul className="draft-item-list">
					{[...items].reverse().map((item) => (
						<li key={item.id}>
							<span className="item-name">{item.name}</span>
							<span className="item-qty">{item.quantity}</span>
						</li>
					))}
				</ul>
			)}

			{segments.length > 0 && !isFinalized && (
				<button className={`done-button ${finalizing ? "is-finalizing" : ""}`} disabled={finalizing} onClick={handleDone}>
					{finalizing ? (
						<>
							<span className="loader-dots" aria-hidden="true">
								<span className="loader-dot" />
								<span className="loader-dot" />
								<span className="loader-dot" />
							</span>
							{FINALIZING_TEXT}
						</>
					) : (
						<>
							<Check weight="bold" size={15} /> முடிந்தது
						</>
					)}
				</button>
			)}
		</div>
	);
}

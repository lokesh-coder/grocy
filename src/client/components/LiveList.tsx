import { useEffect, useRef, useState } from "react";
import { Basket, Check, CheckCircle, Confetti, Eye, LinkSimple, WhatsappLogo, X } from "@phosphor-icons/react";
import type { DraftItem, SessionState } from "../../shared/types";

// Finalizing now does two real API calls in sequence (categorize, then
// estimate prices), so it's a few seconds longer than it used to be -
// cycling through what's actually happening is more honest than a single
// static "wait" label, and gives the eye something to track meanwhile.
const FINALIZING_STEPS = ["பட்டியலை ஒழுங்குபடுத்துகிறேன்…", "விலை மதிப்பிடுகிறேன்…"];

type Props = {
	items: DraftItem[];
	status: SessionState["status"];
	isRecording: boolean;
	onFinalize: () => Promise<{ slug: string }>;
	onDelete: (itemId: string) => void;
	onQuickAdd: (text: string) => void;
};

type FrequentItem = { name: string; quantity: string };

export function LiveList({ items, status, isRecording, onFinalize, onDelete, onQuickAdd }: Props) {
	// Gated on isRecording too, not just status, so the placeholder disappears
	// the instant you hit stop - a final catch-up extraction can still be
	// running server-side after that, but you're no longer watching for a new
	// item to land, so showing it then reads as stuck rather than in-progress.
	const showSkeleton = isRecording && status === "extracting";
	const [shareUrl, setShareUrl] = useState<string | null>(null);
	const [finalizing, setFinalizing] = useState(false);
	const [finalizingStep, setFinalizingStep] = useState(0);
	const [copied, setCopied] = useState(false);
	const [activeItemId, setActiveItemId] = useState<string | null>(null);
	const [frequentItems, setFrequentItems] = useState<FrequentItem[]>([]);
	const finalizingIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

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
		setFinalizingStep(0);
		finalizingIntervalRef.current = setInterval(() => {
			setFinalizingStep((step) => (step + 1) % FINALIZING_STEPS.length);
		}, 1800);
		try {
			const { slug } = await onFinalize();
			setShareUrl(`${window.location.origin}/list/${slug}`);
		} finally {
			setFinalizing(false);
			if (finalizingIntervalRef.current) clearInterval(finalizingIntervalRef.current);
		}
	}

	async function handleShare() {
		if (!shareUrl) return;
		if (navigator.share) {
			try {
				await navigator.share({ title: "மளிகை பட்டியல்", url: shareUrl });
				return;
			} catch {
				// user cancelled or share failed - fall through to clipboard
			}
		}
		await navigator.clipboard.writeText(shareUrl);
		setCopied(true);
		setTimeout(() => setCopied(false), 2000);
	}

	return (
		<div className="list-pane">
			{items.length === 0 && !showSkeleton && (
				<div className="empty-state">
					<Basket weight="duotone" size={56} />
					<p>பேசும்போது இங்கே பொருட்கள் தோன்றும்.</p>
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
				</div>
			)}

			{(items.length > 0 || showSkeleton) && (
				<ul className="draft-item-list">
					{/* At the top, where new items land, so a slow pass reads as "working" not "stuck". */}
					{showSkeleton && (
						<li className="skeleton-item" aria-hidden="true">
							<span className="skeleton-bar skeleton-bar-name" />
							<span className="skeleton-bar skeleton-bar-qty" />
						</li>
					)}
					{/* Extraction lists items oldest-first; reversed so whatever you just said is at the top. */}
					{[...items].reverse().map((item) => (
						<li
							key={item.id}
							className={activeItemId === item.id ? "active" : ""}
							onClick={() => setActiveItemId((prev) => (prev === item.id ? null : item.id))}
						>
							<span className="item-name">{item.name}</span>
							<span className="row-right">
								<span className="item-qty">{item.quantity}</span>
								{activeItemId === item.id && (
									<button
										className="delete-item-button"
										aria-label={`${item.name} நீக்கு`}
										onClick={(event) => {
											event.stopPropagation();
											onDelete(item.id);
										}}
									>
										<X weight="bold" size={13} />
									</button>
								)}
							</span>
						</li>
					))}
				</ul>
			)}

			{items.length > 0 && !shareUrl && (
				<button className={`done-button ${finalizing ? "is-finalizing" : ""}`} disabled={finalizing} onClick={handleDone}>
					{finalizing ? (
						<>
							<span className="loader-dots" aria-hidden="true">
								<span className="loader-dot" />
								<span className="loader-dot" />
								<span className="loader-dot" />
							</span>
							{FINALIZING_STEPS[finalizingStep]}
						</>
					) : (
						<>
							<Check weight="bold" size={15} /> முடிந்தது
						</>
					)}
				</button>
			)}

			{shareUrl && (
				<div className="share-box">
					<span className="confetti-burst" aria-hidden="true">
						<span className="confetti-piece" />
						<span className="confetti-piece" />
						<span className="confetti-piece" />
						<span className="confetti-piece" />
						<span className="confetti-piece" />
						<span className="confetti-piece" />
					</span>
					<div className="share-badge">
						<Confetti weight="duotone" size={28} />
					</div>
					<p className="share-title">பட்டியல் தயார்!</p>
					<p className="share-subtitle">இப்போது பகிரலாம் அல்லது பார்க்கலாம்</p>

					<div className="share-actions">
						<a
							className="whatsapp-link"
							href={`https://wa.me/?text=${encodeURIComponent(`மளிகை பட்டியல்: ${shareUrl}`)}`}
							target="_blank"
							rel="noreferrer"
						>
							<WhatsappLogo weight="duotone" size={18} />
							WhatsApp-இல் பகிரவும்
						</a>
						<div className="share-actions-row">
							<a className="view-list-link" href={shareUrl} target="_blank" rel="noreferrer">
								<Eye weight="bold" size={15} />
								பட்டியலைப் பார்
							</a>
							<button className="copy-button" onClick={handleShare}>
								{copied ? (
									<>
										<CheckCircle weight="fill" size={15} /> நகலெடுக்கப்பட்டது!
									</>
								) : (
									<>
										<LinkSimple weight="bold" size={15} /> இணைப்பை நகலெடு
									</>
								)}
							</button>
						</div>
					</div>
				</div>
			)}
		</div>
	);
}

import { useState } from "react";
import { Basket, Check, CheckCircle, Confetti, LinkSimple, WhatsappLogo, X } from "@phosphor-icons/react";
import type { DraftItem } from "../../shared/types";

type Props = {
	items: DraftItem[];
	onFinalize: () => Promise<{ slug: string }>;
	onDelete: (itemId: string) => void;
};

export function LiveList({ items, onFinalize, onDelete }: Props) {
	const [shareUrl, setShareUrl] = useState<string | null>(null);
	const [finalizing, setFinalizing] = useState(false);
	const [copied, setCopied] = useState(false);

	async function handleDone() {
		setFinalizing(true);
		try {
			const { slug } = await onFinalize();
			setShareUrl(`${window.location.origin}/list/${slug}`);
		} finally {
			setFinalizing(false);
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
			{items.length === 0 && (
				<div className="empty-state">
					<Basket weight="duotone" size={40} />
					<p>பேசும்போது இங்கே பொருட்கள் தோன்றும்.</p>
				</div>
			)}

			{items.length > 0 && (
				<ul className="draft-item-list">
					{/* Extraction lists items oldest-first; reversed so whatever you just said is at the top. */}
					{[...items].reverse().map((item) => (
						<li key={item.id}>
							<span className="item-info">
								<span className="item-name">{item.name}</span>
								<span className="item-qty">{item.quantity}</span>
							</span>
							<button
								className="delete-item-button"
								aria-label={`${item.name} நீக்கு`}
								onClick={() => onDelete(item.id)}
							>
								<X weight="bold" size={13} />
							</button>
						</li>
					))}
				</ul>
			)}

			{items.length > 0 && !shareUrl && (
				<button className="done-button" disabled={finalizing} onClick={handleDone}>
					{finalizing ? (
						"முடிக்கிறேன்…"
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
					<p>
						<Confetti weight="duotone" size={16} /> பட்டியல் தயார்!
					</p>
					<a
						className="whatsapp-link"
						href={`https://wa.me/?text=${encodeURIComponent(`மளிகை பட்டியல்: ${shareUrl}`)}`}
						target="_blank"
						rel="noreferrer"
					>
						<WhatsappLogo weight="duotone" size={17} />
						WhatsApp-இல் பகிரவும்
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
			)}
		</div>
	);
}

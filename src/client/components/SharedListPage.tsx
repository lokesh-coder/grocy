import { useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import { MagicWand, ShoppingCart } from "@phosphor-icons/react";
import { CATEGORIES } from "../../shared/categories";
import { categoryIcon } from "../lib/categoryIcons";
import { categoryColor } from "../lib/categoryColors";
import type { SharedList } from "../../shared/types";

type Props = {
	slug: string;
};

// Categorizing + pricing run on demand here, not automatically at finalize
// (see the /organize route) - cycling through what's happening is more
// honest than a static label for a step that takes a few seconds.
const ORGANIZING_STEPS = ["பொருட்களை வகைப்படுத்துகிறேன்…", "விலை மதிப்பிடுகிறேன்…"];

export function SharedListPage({ slug }: Props) {
	const [list, setList] = useState<SharedList | null>(null);
	const [notFound, setNotFound] = useState(false);
	const [organizing, setOrganizing] = useState(false);
	const [organizingStep, setOrganizingStep] = useState(0);
	const organizingIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

	useEffect(() => {
		let cancelled = false;
		fetch(`/api/list/${slug}`)
			.then((res) => {
				if (!res.ok) throw new Error("not found");
				return res.json() as Promise<SharedList>;
			})
			.then((data) => {
				if (!cancelled) setList(data);
			})
			.catch(() => {
				if (!cancelled) setNotFound(true);
			});
		return () => {
			cancelled = true;
		};
	}, [slug]);

	const grouped = useMemo(() => {
		if (!list) return [];
		return CATEGORIES.map((category) => ({
			category,
			items: list.items.filter((item) => item.category === category.id),
		})).filter((group) => group.items.length > 0);
	}, [list]);

	// Best-effort estimate, not every item necessarily has a price (see
	// estimatePrices in extract.ts) - only sum what's actually priced, and
	// say so if that's not everything.
	const priceSummary = useMemo(() => {
		if (!list) return null;
		const priced = list.items.filter((item) => item.estimatedPrice != null);
		if (priced.length === 0) return null;
		const total = priced.reduce((sum, item) => sum + (item.estimatedPrice ?? 0), 0);
		return { total, pricedCount: priced.length, totalCount: list.items.length };
	}, [list]);

	async function handleOrganize() {
		setOrganizing(true);
		setOrganizingStep(0);
		organizingIntervalRef.current = setInterval(() => {
			setOrganizingStep((step) => (step + 1) % ORGANIZING_STEPS.length);
		}, 1800);
		try {
			const res = await fetch(`/api/list/${slug}/organize`, { method: "POST" });
			if (res.ok) setList(await res.json());
		} finally {
			setOrganizing(false);
			if (organizingIntervalRef.current) clearInterval(organizingIntervalRef.current);
		}
	}

	async function toggle(itemId: string, ticked: boolean) {
		setList((prev) =>
			prev ? { ...prev, items: prev.items.map((item) => (item.id === itemId ? { ...item, ticked } : item)) } : prev,
		);
		await fetch(`/api/list/${slug}/item/${itemId}`, {
			method: "PATCH",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ ticked }),
		});
	}

	if (notFound) {
		return (
			<div className="app-shell">
				<p className="empty-hint">இந்தப் பட்டியல் கிடைக்கவில்லை.</p>
			</div>
		);
	}

	if (!list) {
		return (
			<div className="app-shell">
				<p className="empty-hint">ஏற்றுகிறது…</p>
			</div>
		);
	}

	return (
		<div className="app-shell">
			<header className="top-bar">
				<span className="app-title">
					<ShoppingCart weight="duotone" size={20} />
					மளிகை பட்டியல்
				</span>
			</header>
			<main className="main-area">
				<div className="list-pane">
					{!list.organized && (
						<button className={`organize-button ${organizing ? "is-organizing" : ""}`} disabled={organizing} onClick={handleOrganize}>
							{organizing ? (
								<>
									<span className="loader-dots" aria-hidden="true">
										<span className="loader-dot" />
										<span className="loader-dot" />
										<span className="loader-dot" />
									</span>
									{ORGANIZING_STEPS[organizingStep]}
								</>
							) : (
								<>
									<MagicWand weight="duotone" size={17} />
									வகைப்படுத்தி விலை காட்டு
								</>
							)}
						</button>
					)}

					{priceSummary && (
						<p className="price-summary">
							மதிப்பிடப்பட்ட மொத்தம்: ₹{Math.round(priceSummary.total)}
							{priceSummary.pricedCount < priceSummary.totalCount &&
								` (${priceSummary.pricedCount}/${priceSummary.totalCount} பொருட்களுக்கு)`}
						</p>
					)}

					{!list.organized && (
						<section className="category-group">
							<ul>
								{list.items.map((item) => (
									<li key={item.id} className={item.ticked ? "ticked" : ""}>
										<label>
											<input
												type="checkbox"
												className="check-input"
												checked={item.ticked}
												onChange={(event) => toggle(item.id, event.target.checked)}
											/>
											<span className="check-box" aria-hidden="true" />
											<span className="item-name">{item.name}</span>
											<span className="item-qty">{item.quantity}</span>
										</label>
									</li>
								))}
							</ul>
						</section>
					)}

					{list.organized &&
						grouped.map((group) => {
							const Icon = categoryIcon(group.category.id);
							return (
								<section
									key={group.category.id}
									className="category-group"
									style={{ "--cat-color": categoryColor(group.category.id) } as CSSProperties}
								>
									<h3>
										<Icon weight="duotone" size={16} />
										{group.category.ta}
									</h3>
									<ul>
										{group.items.map((item) => (
											<li key={item.id} className={item.ticked ? "ticked" : ""}>
												<label>
													<input
														type="checkbox"
														className="check-input"
														checked={item.ticked}
														onChange={(event) => toggle(item.id, event.target.checked)}
													/>
													<span className="check-box" aria-hidden="true" />
													<span className="item-name">{item.name}</span>
													<span className="item-qty">
														{item.quantity}
														{item.estimatedPrice != null && (
															<span className="item-price"> · ₹{Math.round(item.estimatedPrice)}</span>
														)}
													</span>
												</label>
											</li>
										))}
								</ul>
							</section>
						);
					})}
				</div>
			</main>
		</div>
	);
}

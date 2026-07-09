import { useEffect, useMemo, useState } from "react";
import { CATEGORIES } from "../../shared/categories";
import type { SharedList } from "../../shared/types";

type Props = {
	slug: string;
};

export function SharedListPage({ slug }: Props) {
	const [list, setList] = useState<SharedList | null>(null);
	const [notFound, setNotFound] = useState(false);

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
			<div className="shared-page">
				<p>இந்தப் பட்டியல் கிடைக்கவில்லை.</p>
			</div>
		);
	}

	if (!list) {
		return (
			<div className="shared-page">
				<p>ஏற்றுகிறது…</p>
			</div>
		);
	}

	return (
		<div className="shared-page">
			<h1>🛒 மளிகை பட்டியல்</h1>
			{grouped.map((group) => (
				<section key={group.category.id} className="category-group">
					<h3>{group.category.ta}</h3>
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
									<span className="item-qty">{item.quantity}</span>
								</label>
							</li>
						))}
					</ul>
				</section>
			))}
		</div>
	);
}

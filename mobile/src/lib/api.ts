import { accessHeaders, API_BASE_URL } from "./config";
import type { SharedList } from "../shared/types";

type FrequentItem = { name: string; quantity: string };

async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
	const res = await fetch(`${API_BASE_URL}${path}`, {
		...init,
		headers: { ...accessHeaders(), ...(init?.headers as Record<string, string> | undefined) },
	});
	if (!res.ok) throw new Error(`${init?.method ?? "GET"} ${path} failed: ${res.status}`);
	return res.json() as Promise<T>;
}

export function getList(slug: string): Promise<SharedList> {
	return apiFetch(`/api/list/${slug}`);
}

export function organizeList(slug: string): Promise<SharedList> {
	return apiFetch(`/api/list/${slug}/organize`, { method: "POST" });
}

export function setItemTicked(slug: string, itemId: string, ticked: boolean): Promise<{ ok: true }> {
	return apiFetch(`/api/list/${slug}/item/${itemId}`, {
		method: "PATCH",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify({ ticked }),
	});
}

export function deleteItem(slug: string, itemId: string): Promise<{ ok: true }> {
	return apiFetch(`/api/list/${slug}/item/${itemId}`, { method: "DELETE" });
}

export function getFrequentItems(): Promise<{ items: FrequentItem[] }> {
	return apiFetch(`/api/frequent-items`);
}

import { accessHeaders, API_BASE_URL } from "./config";
import type { DraftItem, ListItem } from "../shared/types";

async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
	const res = await fetch(`${API_BASE_URL}${path}`, {
		...init,
		headers: { ...accessHeaders(), ...(init?.headers as Record<string, string> | undefined) },
	});
	if (!res.ok) throw new Error(`${init?.method ?? "GET"} ${path} failed: ${res.status}`);
	return res.json() as Promise<T>;
}

export function extractList(transcript: string): Promise<{ items: DraftItem[] }> {
	return apiFetch(`/api/extract`, {
		method: "POST",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify({ transcript }),
	});
}

export function organizeItems(items: DraftItem[]): Promise<{ items: ListItem[] }> {
	return apiFetch(`/api/organize`, {
		method: "POST",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify({ items }),
	});
}

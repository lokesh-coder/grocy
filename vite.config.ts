import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { cloudflare } from "@cloudflare/vite-plugin";
import agents from "agents/vite";

export default defineConfig({
	// agents() must come before the other plugins - it handles the TC39
	// @callable() decorator transform that the Agents SDK relies on.
	plugins: [agents(), react(), cloudflare()],
});

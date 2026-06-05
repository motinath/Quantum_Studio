import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/_app/layout-viewer")({
  beforeLoad: () => {
    throw redirect({ to: "/quantum-editor" });
  },
});

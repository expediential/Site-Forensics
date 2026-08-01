export default defineBackground({
  type: 'module',
  main() {
    // The service worker is intentionally feature-free in Phase 1.
    // Runtime registration begins with the tested Phase 2 infrastructure.
  },
});

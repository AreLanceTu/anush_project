const COUNT_PREFIX = "vivah_like_count_";
const ME_PREFIX = "vivah_like_me_";
const EVENT_KEY = "vivah_like_event";

export function slugifyName(name) {
  return String(name || "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "")
    .replace(/^_+|_+$/g, "");
}

function countKey(slug) {
  return COUNT_PREFIX + slug;
}

function meKey(slug) {
  return ME_PREFIX + slug;
}

export function getLikeState(slug) {
  const key = String(slug || "").trim().toLowerCase();
  if (!key) return { count: 0, liked: false };

  const rawCount = localStorage.getItem(countKey(key));
  const rawLiked = localStorage.getItem(meKey(key));

  const count = Number.parseInt(rawCount || "0", 10);
  const liked = rawLiked === "1";

  return {
    count: Number.isFinite(count) ? Math.max(0, count) : 0,
    liked,
  };
}

export function setLikeState(slug, { count, liked }) {
  const key = String(slug || "").trim().toLowerCase();
  if (!key) return;

  const safeCount = Number.isFinite(count) ? Math.max(0, count) : 0;
  localStorage.setItem(countKey(key), String(safeCount));
  localStorage.setItem(meKey(key), liked ? "1" : "0");

  localStorage.setItem(EVENT_KEY, JSON.stringify({ slug: key, t: Date.now() }));
}

export function toggleLike(slug) {
  const state = getLikeState(slug);
  const next = {
    count: state.liked ? Math.max(0, state.count - 1) : state.count + 1,
    liked: !state.liked,
  };
  setLikeState(slug, next);
  return next;
}

export function bindLikeButton(buttonEl, countEl, slug) {
  if (!buttonEl || !slug) return () => {};

  const updateUi = () => {
    const state = getLikeState(slug);
    if (countEl) countEl.textContent = String(state.count);
    buttonEl.classList.toggle("liked", state.liked);
    buttonEl.setAttribute("aria-pressed", state.liked ? "true" : "false");
  };

  updateUi();

  buttonEl.addEventListener("click", (event) => {
    event.preventDefault();
    toggleLike(slug);
    updateUi();
  });

  return updateUi;
}

export function listenForLikeChanges(handler) {
  if (typeof handler !== "function") return;

  window.addEventListener("storage", (event) => {
    if (event.key === EVENT_KEY && event.newValue) {
      try {
        const data = JSON.parse(event.newValue);
        if (data?.slug) handler(String(data.slug));
      } catch {
        // ignore
      }
      return;
    }

    if (event.key && (event.key.startsWith(COUNT_PREFIX) || event.key.startsWith(ME_PREFIX))) {
      const slug = event.key.replace(COUNT_PREFIX, "").replace(ME_PREFIX, "");
      handler(slug);
    }
  });
}

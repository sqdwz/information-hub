import { landSceneUrl } from "./library-model.js?v=20261124-hd";

export function initializeLandGallery() {
  const dialog = document.querySelector("#land-gallery");
  const read = selector => dialog.querySelector(selector);
  const stage = read("#land-gallery-stage");
  const frame = read(".land-gallery__frame");
  const image = read("#land-gallery-image");
  const status = read("#land-gallery-status");
  const strip = read("#land-gallery-strip");
  const download = read("#land-gallery-download");
  const dimensions = read("#land-gallery-size");
  const buttons = new Map([...dialog.querySelectorAll("[data-gallery-action]")]
    .map(button => [button.dataset.galleryAction, button]));
  let entries = [];
  let current = 0;
  let generation = 0;
  let zoom = 1;
  let fitted = true;
  let drag;

  function fitScale() {
    return Math.min(1, stage.clientWidth / image.naturalWidth, stage.clientHeight / image.naturalHeight);
  }

  function layoutImage(center = false) {
    if (!dialog.open || image.hidden || !image.naturalWidth) return;
    const fit = fitScale();
    zoom = fitted ? fit : Math.max(fit, Math.min(2, zoom));
    const width = Math.round(image.naturalWidth * zoom);
    const height = Math.round(image.naturalHeight * zoom);
    const x = center ? .5 : (stage.scrollLeft + stage.clientWidth / 2) / frame.offsetWidth;
    const y = center ? .5 : (stage.scrollTop + stage.clientHeight / 2) / frame.offsetHeight;
    image.style.width = width + "px";
    image.style.height = height + "px";
    frame.style.width = Math.max(stage.clientWidth, width) + "px";
    frame.style.height = Math.max(stage.clientHeight, height) + "px";
    stage.scrollLeft = Math.round(x * frame.offsetWidth - stage.clientWidth / 2);
    stage.scrollTop = Math.round(y * frame.offsetHeight - stage.clientHeight / 2);
    stage.classList.toggle("is-zoomed", zoom - fit > .001);
    dimensions.textContent = image.naturalWidth + " × " + image.naturalHeight + " · " + Math.round(zoom * 100) + "%";
    buttons.get("out").disabled = zoom <= fit + .001;
    buttons.get("in").disabled = zoom >= 2;
    buttons.get("fit").setAttribute("aria-pressed", String(fitted));
    buttons.get("actual").setAttribute("aria-pressed", String(Math.abs(zoom - 1) < .001));
  }

  function changeZoom(action) {
    if (image.hidden) return;
    fitted = action === "fit";
    if (action === "actual") zoom = 1;
    if (action === "in") zoom *= 1.35;
    if (action === "out") {
      zoom /= 1.35;
      if (zoom <= fitScale()) fitted = true;
    }
    layoutImage();
  }

  function renderStrip() {
    const start = Math.max(0, Math.min(current - 2, entries.length - 5));
    strip.replaceChildren(...entries.slice(start, start + 5).map((record, offset) => {
      const index = start + offset;
      const thumb = document.createElement("button");
      thumb.type = "button";
      thumb.dataset.galleryIndex = index;
      thumb.setAttribute("aria-label", record.code + " " + record.name);
      if (index === current) thumb.setAttribute("aria-current", "true");
      const preview = new Image();
      preview.alt = "";
      preview.width = 72;
      preview.height = 44;
      preview.src = landSceneUrl(record).href;
      const code = Object.assign(document.createElement("span"), { textContent: record.code });
      thumb.append(preview, code);
      return thumb;
    }));
  }

  async function show(index, focusThumb = false) {
    if (index < 0 || index >= entries.length) return;
    const request = ++generation;
    current = index;
    fitted = true;
    drag = null;
    stage.classList.remove("is-dragging", "is-zoomed");
    const record = entries[current];
    const label = record.code + " " + record.name;
    read("#land-gallery-title").textContent = label;
    read("#land-gallery-position").textContent = (current + 1) + " / " + entries.length;
    dimensions.textContent = "";
    const focusWasPrevious = document.activeElement === buttons.get("previous");
    const focusWasNext = document.activeElement === buttons.get("next");
    buttons.get("previous").disabled = current === 0;
    buttons.get("next").disabled = current === entries.length - 1;
    if ((focusWasPrevious && current === 0) || (focusWasNext && current === entries.length - 1)) stage.focus();
    for (const action of ["in", "out", "fit", "actual"]) buttons.get(action).disabled = true;
    image.hidden = true;
    image.alt = label + "场景示意";
    frame.style.width = "";
    frame.style.height = "";
    download.removeAttribute("href");
    status.hidden = false;
    status.textContent = "正在载入高清图…";
    renderStrip();
    if (focusThumb) strip.querySelector('[aria-current="true"]')?.focus();
    const url = landSceneUrl(record, { highResolution: true });
    image.src = url.href;
    try {
      await image.decode();
      if (request !== generation || !dialog.open) return;
      image.hidden = false;
      status.hidden = true;
      download.href = url.href;
      download.download = label.replace(" ", "_") + ".webp";
      buttons.get("fit").disabled = false;
      buttons.get("actual").disabled = false;
      layoutImage(true);
    } catch {
      if (request === generation && dialog.open) status.textContent = "高清图加载失败，请重开图集后再试。";
    }
  }

  function close() {
    if (dialog.open) dialog.close();
  }

  dialog.addEventListener("click", event => {
    if (event.target === dialog) {
      const bounds = dialog.getBoundingClientRect();
      if (event.clientX < bounds.left || event.clientX > bounds.right ||
          event.clientY < bounds.top || event.clientY > bounds.bottom) close();
      return;
    }
    const thumb = event.target.closest("[data-gallery-index]");
    if (thumb) {
      if (Number(thumb.dataset.galleryIndex) !== current) show(Number(thumb.dataset.galleryIndex), true);
      return;
    }
    const action = event.target.closest("[data-gallery-action]")?.dataset.galleryAction;
    if (action === "close") close();
    else if (action === "previous") show(current - 1);
    else if (action === "next") show(current + 1);
    else if (action) changeZoom(action);
  });

  dialog.addEventListener("keydown", event => {
    const step = { ArrowLeft: -1, ArrowRight: 1 }[event.key];
    const action = { "+": "in", "=": "in", "-": "out", "0": "fit" }[event.key];
    if ((event.ctrlKey || event.metaKey || event.altKey) || (!step && !action)) return;
    if (step && event.target === stage && stage.classList.contains("is-zoomed")) return;
    event.preventDefault();
    if (step) show(current + step, strip.contains(event.target));
    else changeZoom(action);
  });

  stage.addEventListener("dblclick", () => changeZoom(fitted ? "actual" : "fit"));
  stage.addEventListener("wheel", event => {
    if (!event.ctrlKey && !event.metaKey) return;
    event.preventDefault();
    changeZoom(event.deltaY < 0 ? "in" : "out");
  }, { passive: false });
  stage.addEventListener("pointerdown", event => {
    if (event.pointerType !== "mouse" || event.button !== 0 || !stage.classList.contains("is-zoomed")) return;
    drag = { id: event.pointerId, x: event.clientX + stage.scrollLeft, y: event.clientY + stage.scrollTop };
    stage.setPointerCapture(event.pointerId);
    stage.classList.add("is-dragging");
  });
  stage.addEventListener("pointermove", event => {
    if (drag?.id !== event.pointerId) return;
    stage.scrollLeft = drag.x - event.clientX;
    stage.scrollTop = drag.y - event.clientY;
  });
  stage.addEventListener("lostpointercapture", () => {
    drag = null;
    stage.classList.remove("is-dragging");
  });
  dialog.addEventListener("close", () => {
    if (dialog.open) return;
    generation++;
    image.removeAttribute("src");
    image.hidden = true;
    strip.replaceChildren();
  });
  new ResizeObserver(() => layoutImage()).observe(stage);

  return {
    open(records, code) {
      if (!records.length) return;
      entries = records;
      if (!dialog.open) dialog.showModal();
      show(Math.max(0, records.findIndex(record => record.code === code)));
    },
    close
  };
}

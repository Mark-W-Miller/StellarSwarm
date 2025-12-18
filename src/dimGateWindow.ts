export function createDimGateUI(currentPath: string) {
  const header = document.createElement("div");
  header.className = "scene-nav";

  const title = document.createElement("div");
  title.className = "scene-nav__title";
  title.textContent = "Dimension Gate";

  const links = document.createElement("div");
  links.className = "scene-nav__links";

  const swarmLink = document.createElement("a");
  swarmLink.href = "/stellar-swarm";
  swarmLink.textContent = "Stellar Swarm";
  if (currentPath === "/stellar-swarm") swarmLink.classList.add("is-active");

  const dimGateLink = document.createElement("a");
  dimGateLink.href = "/dim-gate";
  dimGateLink.textContent = "Dimension Gate";
  if (currentPath === "/dim-gate") dimGateLink.classList.add("is-active");

  links.append(swarmLink, dimGateLink);
  header.append(title, links);

  const badge = document.createElement("div");
  badge.className = "scene-tag";
  badge.textContent = "Vracken Gate prototype";

  document.body.append(header, badge);

  const dispose = () => {
    header.remove();
    badge.remove();
  };

  return dispose;
}

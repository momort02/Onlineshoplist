// Variables globales pour la gestion des listes multiples
let listeActive = "courses"; // Liste active par défaut
let listes = {}; // Stockage de toutes les listes
let rechercheActive = "";

window.onload = function () {
  // Charger le thème sauvegardé
  const savedTheme = localStorage.getItem("theme") || "light";
  document.documentElement.setAttribute("data-theme", savedTheme);
  updateThemeIcon();
  
  // Initialiser le mode hors ligne
  initModeHorsLigne();
  
  // Charger les listes existantes
  chargerListes();
  
  // Charger la liste active
  const liste = JSON.parse(localStorage.getItem(listeActive)) || [];
  liste.forEach((item, index) => creerItem(index, item));
  mettreAJourStats();
};

function ajouterItem() {
  const liste = JSON.parse(localStorage.getItem(listeActive)) || [];
  liste.push({ nom: "", qte: "", unite: "pièces", cat: "Catégorie", coche: false });
  localStorage.setItem(listeActive, JSON.stringify(liste));
  sauvegarderHorsLigne();
  creerItem(liste.length - 1, liste[liste.length - 1]);
  mettreAJourStats();
}

function creerItem(index, item) {
  const div = document.createElement("div");
  div.className = "item-course";

  const check = document.createElement("input");
  check.type = "checkbox";
  check.checked = item.coche;
  check.onchange = () => {
    const liste = JSON.parse(localStorage.getItem(listeActive)) || [];
    liste[index].coche = check.checked;
    localStorage.setItem(listeActive, JSON.stringify(liste));
    sauvegarderHorsLigne();
    mettreAJourStats();
  };

  const nom = document.createElement("input");
  nom.type = "text";
  nom.placeholder = "Produit";
  nom.value = item.nom;
  nom.className = "nom";
  nom.oninput = () => {
    const liste = JSON.parse(localStorage.getItem(listeActive)) || [];
    liste[index].nom = nom.value;
    localStorage.setItem(listeActive, JSON.stringify(liste));
    sauvegarderHorsLigne();
  };

  const qte = document.createElement("input");
  qte.type = "number";
  qte.placeholder = "Qté";
  qte.value = item.qte;
  qte.className = "qte";
  qte.oninput = () => {
    const liste = JSON.parse(localStorage.getItem(listeActive)) || [];
    liste[index].qte = qte.value;
    localStorage.setItem(listeActive, JSON.stringify(liste));
    sauvegarderHorsLigne();
  };

  const unite = document.createElement("select");
  const unites = ["pièces", "kg", "g", "mg", "l", "cl", "ml", "sachets", "boîtes"];
  unites.forEach(u => {
    const o = document.createElement("option");
    o.value = u;
    o.textContent = u;
    if (u === (item.unite || "pièces")) o.selected = true;
    unite.appendChild(o);
  });
  unite.className = "unite";
  unite.onchange = () => {
    const liste = JSON.parse(localStorage.getItem(listeActive)) || [];
    liste[index].unite = unite.value;
    localStorage.setItem(listeActive, JSON.stringify(liste));
    sauvegarderHorsLigne();
  };

  const cat = document.createElement("select");
  const options = ["Fruits", "Légumes", "Viande", "Boissons", "Hygiène", "Autre", "Catégorie"];
  options.forEach(opt => {
    const o = document.createElement("option");
    o.value = opt;
    o.textContent = opt;
    if (opt === item.cat) o.selected = true;
    cat.appendChild(o);
  });
  cat.onchange = () => {
    const liste = JSON.parse(localStorage.getItem(listeActive)) || [];
    liste[index].cat = cat.value;
    localStorage.setItem(listeActive, JSON.stringify(liste));
    sauvegarderHorsLigne();
  };

  const del = document.createElement("button");
  del.textContent = "❌";
  del.onclick = () => {
    let liste = JSON.parse(localStorage.getItem(listeActive)) || [];
    liste.splice(index, 1);
    localStorage.setItem(listeActive, JSON.stringify(liste));
    sauvegarderHorsLigne();
    rechargerListe();
  };

  div.appendChild(check);
  div.appendChild(nom);
  div.appendChild(qte);
  div.appendChild(unite);
  div.appendChild(cat);
  div.appendChild(del);
  document.getElementById("listeCourses").appendChild(div);
}

function resetListe() {
  localStorage.removeItem(listeActive);
  sauvegarderHorsLigne();
  rechargerListe();
}

function rechargerListe() {
  document.getElementById("listeCourses").innerHTML = "";
  const liste = JSON.parse(localStorage.getItem(listeActive)) || [];
  liste.forEach((item, index) => creerItem(index, item));
  mettreAJourStats();
  appliquerRecherche();
}

function mettreAJourStats() {
  const liste = JSON.parse(localStorage.getItem(listeActive)) || [];
  const total = liste.length;
  const coches = liste.filter(i => i.coche).length;
  const nomListe = listes[listeActive] || "Liste";
  document.getElementById("stats").textContent = `✔️ ${coches} sur ${total} articles dans "${nomListe}"`;
}

function exporterTexte() {
  const liste = JSON.parse(localStorage.getItem(listeActive)) || [];
  const nomListe = listes[listeActive] || "Liste de courses";
  return `${nomListe}:\n` + liste
    .map(i => `- ${i.nom} ${i.qte || 1} ${i.unite || "pièces"} (${i.cat})${i.coche ? " ✅" : ""}`)
    .join("\n");
}

function copierListe() {
  const text = exporterTexte();
  navigator.clipboard.writeText(text).then(() => {
    alert("Liste copiée !");
  });
}

function envoyerWhatsApp() {
  const msg = encodeURIComponent(exporterTexte());
  window.open(`https://wa.me/?text=${msg}`, "_blank");
}

function envoyerMessage() {
  const msg = encodeURIComponent(exporterTexte());
  window.open(`sms:?body=${msg}`, "_blank");
}

function toggleTheme() {
  const currentTheme = document.documentElement.getAttribute("data-theme");
  const newTheme = currentTheme === "dark" ? "light" : "dark";
  
  document.documentElement.setAttribute("data-theme", newTheme);
  localStorage.setItem("theme", newTheme);
  updateThemeIcon();
}

function updateThemeIcon() {
  const theme = document.documentElement.getAttribute("data-theme");
  const button = document.querySelector(".theme-toggle");
  if (button) {
    button.textContent = theme === "dark" ? "☀️" : "🌙";
  }
}

// Gestion des listes multiples
function chargerListes() {
  listes = JSON.parse(localStorage.getItem("listes")) || { "courses": "Courses" };
  listeActive = localStorage.getItem("listeActive") || "courses";
  afficherOnglets();
}

function sauvegarderListes() {
  localStorage.setItem("listes", JSON.stringify(listes));
  localStorage.setItem("listeActive", listeActive);
}

function afficherOnglets() {
  const container = document.getElementById("listsTabs");
  container.innerHTML = "";
  
  Object.keys(listes).forEach(id => {
    const tabContainer = document.createElement("div");
    tabContainer.className = "tab-container";
    
    const tab = document.createElement("button");
    tab.className = `list-tab ${id === listeActive ? "active" : ""}`;
    tab.textContent = listes[id];
    tab.onclick = () => changerListe(id);
    
    tabContainer.appendChild(tab);
    
    // Bouton de suppression pour les listes non-principales
    if (id !== "courses") {
      const deleteBtn = document.createElement("button");
      deleteBtn.className = "delete-list-btn";
      deleteBtn.textContent = "❌";
      deleteBtn.onclick = (e) => {
        e.stopPropagation();
        supprimerListe(id);
      };
      deleteBtn.title = "Supprimer cette liste";
      tabContainer.appendChild(deleteBtn);
    }
    
    container.appendChild(tabContainer);
  });
}

function changerListe(id) {
  listeActive = id;
  sauvegarderListes();
  afficherOnglets();
  rechargerListe();
}

function ajouterNouvelleListe() {
  const nom = prompt("Nom de la nouvelle liste :");
  if (nom && nom.trim()) {
    const id = "liste_" + Date.now();
    listes[id] = nom.trim();
    listeActive = id;
    localStorage.setItem(id, JSON.stringify([]));
    sauvegarderListes();
    afficherOnglets();
    rechargerListe();
  }
}

function supprimerListe(id) {
  if (id === "courses") return; // Ne pas supprimer la liste principale
  if (confirm(`Supprimer la liste "${listes[id]}" ?`)) {
    delete listes[id];
    localStorage.removeItem(id);
    if (listeActive === id) {
      listeActive = "courses";
    }
    sauvegarderListes();
    afficherOnglets();
    rechargerListe();
  }
}

// Fonction de recherche
function rechercherArticles() {
  rechercheActive = document.getElementById("searchInput").value.toLowerCase();
  appliquerRecherche();
}

function appliquerRecherche() {
  const items = document.querySelectorAll(".item-course");
  items.forEach(item => {
    const nom = item.querySelector(".nom").value.toLowerCase();
    const visible = !rechercheActive || nom.includes(rechercheActive);
    item.classList.toggle("hidden", !visible);
  });
}



// Mode hors ligne
function initModeHorsLigne() {
  updateStatusIndicator();
  
  window.addEventListener("online", () => {
    updateStatusIndicator();
    synchroniserDonnees();
  });
  
  window.addEventListener("offline", () => {
    updateStatusIndicator();
  });
}

function updateStatusIndicator() {
  const indicator = document.getElementById("statusIndicator");
  if (navigator.onLine) {
    indicator.textContent = "📶";
    indicator.title = "En ligne";
  } else {
    indicator.textContent = "📵";
    indicator.title = "Hors ligne";
  }
}

function sauvegarderHorsLigne() {
  const timestamp = Date.now();
  localStorage.setItem("derniereModification", timestamp.toString());
}

function synchroniserDonnees() {
  // Ici on pourrait ajouter une synchronisation avec un serveur
  console.log("Synchronisation des données...");
}




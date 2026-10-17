const STORAGE_KEY = "studyspark_data_v1";
const DEFAULT_DECKS = ["Emerging Technology", "Programming", "Mathematics"];
const $ = id => document.getElementById(id);
let data = loadData();
let activeView = "all";
let activeDeck = "all";
let studyIds = [];
let studyIndex = 0;
let answerVisible = false;
let pendingDelete = null;
let pendingDeleteType = "card";

function loadData() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && Array.isArray(parsed.decks) && Array.isArray(parsed.cards)) return parsed;
    }
  } catch (error) { console.warn("Saved StudySpark data could not be read.", error); }
  return {
    decks: DEFAULT_DECKS.map((name, index) => ({ id: `deck-${index + 1}`, name })),
    cards: [
      { id: "demo-1", deckId: "deck-1", question: "What is artificial intelligence (AI)?", answer: "Technology that enables computers to perform tasks that typically require human intelligence.", mastered: false, createdAt: Date.now() },
      { id: "demo-2", deckId: "deck-2", question: "What does HTML stand for?", answer: "HyperText Markup Language. It structures content on web pages.", mastered: false, createdAt: Date.now() + 1 },
      { id: "demo-3", deckId: "deck-2", question: "What is CSS used for?", answer: "Cascading Style Sheets describe how HTML content looks, including colors, spacing, and layout.", mastered: true, createdAt: Date.now() + 2 },
      { id: "demo-4", deckId: "deck-3", question: "What is the value of π rounded to two decimals?", answer: "3.14. Pi is the ratio of a circle's circumference to its diameter.", mastered: false, createdAt: Date.now() + 3 }
    ]
  };
}
function saveData() {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(data)); }
  catch (error) { toast("Could not save data. Check browser storage settings."); console.error(error); }
}
function id() {
  return window.crypto && crypto.randomUUID ? crypto.randomUUID() : `id-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}
function escapeHTML(value) {
  return String(value).replace(/[&<>"']/g, char => ({ "&":"&amp;", "<":"&lt;", ">":"&gt;", '"':"&quot;", "'":"&#39;" }[char]));
}
function getDeck(deckId) { return data.decks.find(deck => deck.id === deckId); }
function getCardsForView() {
  let cards = [...data.cards];
  if (activeView === "unreviewed") cards = cards.filter(card => !card.mastered);
  if (activeView === "mastered") cards = cards.filter(card => card.mastered);
  if (activeDeck !== "all") cards = cards.filter(card => card.deckId === activeDeck);
  return cards;
}
function toast(message) {
  const el = $("toast");
  el.textContent = message;
  el.classList.add("show");
  clearTimeout(toast.timer);
  toast.timer = setTimeout(() => el.classList.remove("show"), 2300);
}
function renderStats() {
  const mastered = data.cards.filter(card => card.mastered).length;
  $("statTotal").textContent = data.cards.length;
  $("statMastered").textContent = mastered;
  $("statPractice").textContent = data.cards.length - mastered;
  $("sideAll").textContent = data.cards.length;
  $("sidePractice").textContent = data.cards.filter(card => !card.mastered).length;
  $("sideMastered").textContent = mastered;
}
function renderDecks() {
  $("deckList").innerHTML = data.decks.map(deck => {
    const count = data.cards.filter(card => card.deckId === deck.id).length;
    return `<button class="deck-item ${activeDeck === deck.id ? "selected" : ""}" data-action="select-deck" data-id="${deck.id}" type="button"><span class="deck-dot"></span><span>${escapeHTML(deck.name)}</span><span>${count}</span></button>`;
  }).join("");
  const options = data.decks.map(deck => `<option value="${deck.id}">${escapeHTML(deck.name)}</option>`).join("");
  const currentFilter = activeDeck;
  $("deckFilter").innerHTML = `<option value="all">All subjects</option>${options}`;
  $("deckFilter").value = data.decks.some(deck => deck.id === currentFilter) ? currentFilter : "all";
  $("cardDeckInput").innerHTML = options;
  if (!data.decks.length) $("cardDeckInput").innerHTML = `<option value="">Create a deck first</option>`;
}
function renderCards() {
  const query = $("searchInput").value.trim().toLowerCase();
  const deckFilter = $("deckFilter").value;
  const progress = $("progressFilter").value;
  const cards = getCardsForView().filter(card => {
    const deck = getDeck(card.deckId);
    const text = `${card.question} ${card.answer} ${deck ? deck.name : ""}`.toLowerCase();
    return text.includes(query) && (deckFilter === "all" || card.deckId === deckFilter) &&
      (progress === "all" || (progress === "mastered" && card.mastered) || (progress === "unreviewed" && !card.mastered));
  }).sort((a,b) => b.createdAt - a.createdAt);
  $("resultCount").textContent = `${cards.length} ${cards.length === 1 ? "card" : "cards"}`;
  $("flashcardGrid").innerHTML = cards.map(card => {
    const deck = getDeck(card.deckId);
    return `<article class="mini-card">
      <div class="mini-top"><span class="mini-subject">${escapeHTML(deck ? deck.name : "Unknown deck")}</span><span class="status-chip ${card.mastered ? "mastered" : ""}">${card.mastered ? "✓ Remembered" : "↻ Practice"}</span></div>
      <h3 class="mini-question">${escapeHTML(card.question)}</h3><p class="mini-answer">${escapeHTML(card.answer)}</p>
      <div class="mini-bottom"><button type="button" data-action="study-card" data-id="${card.id}">Study card ↗</button><span><button type="button" data-action="edit-card" data-id="${card.id}" aria-label="Edit card">Edit</button><button class="delete-mini" type="button" data-action="delete-card" data-id="${card.id}" aria-label="Delete card">Delete</button></span></div>
    </article>`;
  }).join("");
  $("collectionEmpty").classList.toggle("hidden", cards.length > 0);
  $("flashcardGrid").classList.toggle("hidden", cards.length === 0);
}
function currentStudyCards() {
  const cards = getCardsForView();
  const ids = new Set(cards.map(card => card.id));
  let chosen = studyIds.map(cardId => data.cards.find(card => card.id === cardId)).filter(card => card && ids.has(card.id));
  if (!chosen.length) chosen = cards;
  return chosen;
}
function startStudy(cards, shuffle = false) {
  studyIds = cards.map(card => card.id);
  if (shuffle) studyIds.sort(() => Math.random() - .5);
  studyIndex = 0;
  answerVisible = false;
  renderStudy();
  $("study").scrollIntoView({ behavior: "smooth", block: "start" });
}
function renderStudy() {
  const cards = currentStudyCards();
  const chosen = cards[studyIndex];
  $("studyDeckName").textContent = activeDeck === "all" ? "All flashcards" : (getDeck(activeDeck)?.name || "Subject deck");
  if (!chosen) {
    $("studyArea").innerHTML = `<div class="study-empty"><span>✧</span><h3>Your next discovery starts here</h3><p>Create a flashcard or select a deck to begin studying.</p><button class="button primary" data-action="new-card" type="button">＋ Create first card</button></div>`;
    return;
  }
  const percent = Math.round(((studyIndex + 1) / cards.length) * 100);
  $("studyArea").innerHTML = `<div class="study-stage">
    <div class="study-count"><span>Card ${studyIndex + 1} of ${cards.length}</span><span>${percent}% through deck</span></div>
    <div class="study-progress"><span style="width:${percent}%"></span></div>
    <div class="study-card" role="button" tabindex="0" data-action="flip" aria-label="${answerVisible ? "Show question" : "Reveal answer"}">
      <span class="card-label">${answerVisible ? "ANSWER" : "QUESTION"}</span>
      <h3>${escapeHTML(answerVisible ? chosen.answer : chosen.question)}</h3>
      <p>${answerVisible ? "Tap to see the question again" : "Click the card to reveal the answer ↗"}</p>
    </div>
    <div class="study-controls">
      <button class="button secondary" data-action="previous" type="button" ${studyIndex === 0 ? "disabled" : ""}>← Previous</button>
      <button class="button secondary" data-action="next" type="button" ${studyIndex >= cards.length - 1 ? "disabled" : ""}>Next →</button>
      <button class="button ${chosen.mastered ? "secondary" : "primary"}" data-action="mark" data-id="${chosen.id}" type="button">${chosen.mastered ? "✓ Remembered" : "✓ I know this"}</button>
      <button class="button secondary" data-action="practice" data-id="${chosen.id}" type="button">↻ Practice</button>
    </div>
  </div>`;
}
function render() { renderStats(); renderDecks(); renderCards(); renderStudy(); }
function openCardDialog(card = null) {
  if (!data.decks.length) { openDeckDialog(); toast("Create a subject deck first."); return; }
  $("cardForm").reset();
  $("editCardId").value = card ? card.id : "";
  $("cardDialogTitle").textContent = card ? "Edit flashcard" : "Create a flashcard";
  $("saveCardButton").textContent = card ? "Save changes ↗" : "Save flashcard ↗";
  if (card) {
    $("questionInput").value = card.question;
    $("answerInput").value = card.answer;
    $("cardDeckInput").value = card.deckId;
  } else $("cardDeckInput").value = data.decks[0].id;
  $("cardDialog").showModal();
  $("questionInput").focus();
}
function openDeckDialog() { $("deckForm").reset(); $("deckDialog").showModal(); $("deckNameInput").focus(); }
function openDelete(type, targetId) {
  pendingDeleteType = type; pendingDelete = targetId;
  const deck = type === "deck" ? getDeck(targetId) : null;
  $("deleteTitle").textContent = type === "deck" ? "Delete subject deck?" : "Delete flashcard?";
  $("deleteMessage").textContent = type === "deck" ? `Delete "${deck?.name || "this deck"}" and all its flashcards? This cannot be undone.` : "This flashcard will be permanently deleted from this browser.";
  $("confirmDelete").textContent = type === "deck" ? "Delete deck" : "Delete card";
  $("deleteDialog").showModal();
}
document.querySelectorAll("[data-close]").forEach(button => button.addEventListener("click", () => $(button.dataset.close).close()));
$("jumpAdd").addEventListener("click", () => openCardDialog());
$("heroAdd").addEventListener("click", () => openCardDialog());
$("emptyAdd").addEventListener("click", () => openCardDialog());
$("addDeckBtn").addEventListener("click", openDeckDialog);
$("cardForm").addEventListener("submit", event => {
  event.preventDefault();
  const question = $("questionInput").value.trim();
  const answer = $("answerInput").value.trim();
  const deckId = $("cardDeckInput").value;
  if (!question || !answer || !getDeck(deckId)) { toast("Please complete all fields and choose a deck."); return; }
  const editId = $("editCardId").value;
  if (editId) {
    const card = data.cards.find(item => item.id === editId);
    if (card) Object.assign(card, { question, answer, deckId });
    toast("Flashcard updated.");
  } else {
    data.cards.push({ id: id(), question, answer, deckId, mastered: false, createdAt: Date.now() });
    toast("Flashcard created.");
  }
  saveData(); $("cardDialog").close(); render();
});
$("deckForm").addEventListener("submit", event => {
  event.preventDefault();
  const name = $("deckNameInput").value.trim();
  if (!name) return;
  if (data.decks.some(deck => deck.name.toLowerCase() === name.toLowerCase())) { toast("A deck with that name already exists."); return; }
  const deck = { id: id(), name };
  data.decks.push(deck);
  activeDeck = deck.id; activeView = "all";
  saveData(); $("deckDialog").close(); render(); toast("Subject deck created.");
});
$("confirmDelete").addEventListener("click", event => {
  if (!pendingDelete) return;
  event.preventDefault();
  if (pendingDeleteType === "deck") {
    data.decks = data.decks.filter(deck => deck.id !== pendingDelete);
    data.cards = data.cards.filter(card => card.deckId !== pendingDelete);
    if (activeDeck === pendingDelete) activeDeck = "all";
    toast("Subject deck and its cards deleted.");
  } else {
    data.cards = data.cards.filter(card => card.id !== pendingDelete);
    studyIds = studyIds.filter(cardId => cardId !== pendingDelete);
    studyIndex = Math.min(studyIndex, Math.max(0, studyIds.length - 1));
    toast("Flashcard deleted.");
  }
  pendingDelete = null; saveData(); $("deleteDialog").close(); render();
});
$("deckList").addEventListener("click", event => {
  const button = event.target.closest("[data-action='select-deck']");
  if (!button) return;
  activeDeck = button.dataset.id; activeView = "all";
  document.querySelectorAll(".side-link").forEach(item => item.classList.remove("selected"));
  render(); startStudy(getCardsForView());
});
document.querySelectorAll(".side-link").forEach(button => button.addEventListener("click", () => {
  activeView = button.dataset.view; activeDeck = "all";
  document.querySelectorAll(".side-link").forEach(item => item.classList.toggle("selected", item === button));
  render(); startStudy(getCardsForView());
}));
$("flashcardGrid").addEventListener("click", event => {
  const button = event.target.closest("[data-action]");
  if (!button) return;
  const card = data.cards.find(item => item.id === button.dataset.id);
  if (button.dataset.action === "study-card" && card) startStudy([card]);
  if (button.dataset.action === "edit-card" && card) openCardDialog(card);
  if (button.dataset.action === "delete-card" && card) openDelete("card", card.id);
});
$("studyArea").addEventListener("click", event => {
  const control = event.target.closest("[data-action]");
  if (!control) return;
  const action = control.dataset.action;
  if (action === "new-card") { openCardDialog(); return; }
  if (action === "flip") { answerVisible = !answerVisible; renderStudy(); return; }
  const cards = currentStudyCards();
  const card = data.cards.find(item => item.id === control.dataset.id);
  if (action === "previous" && studyIndex > 0) { studyIndex--; answerVisible = false; renderStudy(); }
  if (action === "next" && studyIndex < cards.length - 1) { studyIndex++; answerVisible = false; renderStudy(); }
  if (action === "mark" && card) { card.mastered = true; saveData(); render(); toast("Marked as remembered."); }
  if (action === "practice" && card) { card.mastered = false; saveData(); render(); toast("Added back to practice."); }
});
$("studyArea").addEventListener("keydown", event => {
  if ((event.key === "Enter" || event.key === " ") && event.target.matches(".study-card")) {
    event.preventDefault(); answerVisible = !answerVisible; renderStudy();
  }
});
$("searchInput").addEventListener("input", renderCards);
$("deckFilter").addEventListener("change", () => { activeDeck = $("deckFilter").value; render(); });
$("progressFilter").addEventListener("change", renderCards);
$("shuffleBtn").addEventListener("click", () => {
  const cards = getCardsForView();
  if (!cards.length) { toast("Add a flashcard to start studying."); return; }
  startStudy(cards, true);
});
render();
startStudy(getCardsForView());

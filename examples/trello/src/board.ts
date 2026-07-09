export type Card = { id: string; title: string; listId: string }
export type List = { id: string; title: string; cardIds: string[] }
export type Board = {
  id: string
  title: string
  lists: List[]
  cards: Record<string, Card>
}

function id(prefix: string) {
  return prefix + Math.random().toString(36).slice(2, 8)
}

const board: Board = {
  id: "b1",
  title: "Potato Launch",
  lists: [
    { id: "l1", title: "Backlog", cardIds: ["c1", "c2"] },
    { id: "l2", title: "Doing", cardIds: ["c3"] },
    { id: "l3", title: "Done", cardIds: [] },
  ],
  cards: {
    c1: { id: "c1", title: "Ship typed stores", listId: "l1" },
    c2: { id: "c2", title: "Live morph multiplayer", listId: "l1" },
    c3: { id: "c3", title: "Write Trello demo", listId: "l2" },
  },
}

export function getBoard(): Board {
  return board
}

export function snapshot(): Board {
  return JSON.parse(JSON.stringify(board)) as Board
}

export function addCard(listId: string, title: string): Card | null {
  const list = board.lists.find((l) => l.id === listId)
  if (!list || !title.trim()) return null
  const card: Card = { id: id("c"), title: title.trim(), listId }
  board.cards[card.id] = card
  list.cardIds.push(card.id)
  return card
}

export function moveCard(cardId: string, toListId: string): void {
  const card = board.cards[cardId]
  if (!card) return
  const from = board.lists.find((l) => l.id === card.listId)
  const to = board.lists.find((l) => l.id === toListId)
  if (!from || !to || from.id === to.id) return
  from.cardIds = from.cardIds.filter((x) => x !== cardId)
  to.cardIds.push(cardId)
  card.listId = toListId
}

export function renameCard(cardId: string, title: string): void {
  const card = board.cards[cardId]
  if (card && title.trim()) card.title = title.trim()
}

export function addList(title: string): List | null {
  if (!title.trim()) return null
  const list: List = { id: id("l"), title: title.trim(), cardIds: [] }
  board.lists.push(list)
  return list
}

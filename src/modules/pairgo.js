// Pair Go / team Go (2n players) integration with the SGF game tree.
//
// All pair Go data lives in the tree itself, so saving/loading SGF files
// preserves team configurations automatically:
//
// - Root property XS[n]          — team size n (custom; absent means n = 1)
// - Root property XPB[...][...]  — black team player names, one value per seat
// - Root property XPW[...][...]  — white team player names, one value per seat
// - Root property XRB/XRW        — team ranks, aligned with XPB/XPW (custom)
// - Node property XSEAT[s]       — seat of the player who played this move
//
// For compatibility with other SGF software, PB/PW always carry the team
// names joined with ' + ' and BR/WR the first team member's rank.

import {getRootProperty} from './gametree.js'
import {
  createPlayers,
  getSeatForMoveNumber,
  getTeamPlayers,
  normalizeTeamSize,
} from './rotation.js'

export const PAIR_GO_PROPS = {
  teamSize: 'XS',
  blackTeamNames: 'XPB',
  whiteTeamNames: 'XPW',
  blackTeamRanks: 'XRB',
  whiteTeamRanks: 'XRW',
  moveSeat: 'XSEAT',
}

const rootCustomProps = [
  PAIR_GO_PROPS.teamSize,
  PAIR_GO_PROPS.blackTeamNames,
  PAIR_GO_PROPS.whiteTeamNames,
  PAIR_GO_PROPS.blackTeamRanks,
  PAIR_GO_PROPS.whiteTeamRanks,
]

function getRootValues(tree, property) {
  let values = tree.root.data[property]
  if (values == null) return null

  let result = values.map((value) => value.toString())
  return result.some((value) => value.trim() !== '') ? result : null
}

export function isPairGoTree(tree) {
  return getTeamInfo(tree).teamSize > 1
}

export function getTeamInfo(tree) {
  let n = normalizeTeamSize(getRootProperty(tree, PAIR_GO_PROPS.teamSize, 1))

  // Fall back to the number of team name entries if XS is missing
  let blackNames = getRootValues(tree, PAIR_GO_PROPS.blackTeamNames)
  let whiteNames = getRootValues(tree, PAIR_GO_PROPS.whiteTeamNames)

  if (n === 1 && (blackNames != null || whiteNames != null)) {
    n = Math.max(
      blackNames != null ? blackNames.length : 1,
      whiteNames != null ? whiteNames.length : 1,
    )
  }

  if (blackNames == null) {
    let pb = getRootProperty(tree, 'PB') || getRootProperty(tree, 'BT')
    blackNames = pb != null ? [pb] : []
  }

  if (whiteNames == null) {
    let pw = getRootProperty(tree, 'PW') || getRootProperty(tree, 'WT')
    whiteNames = pw != null ? [pw] : []
  }

  let blackRanks = getRootValues(tree, PAIR_GO_PROPS.blackTeamRanks)
  let whiteRanks = getRootValues(tree, PAIR_GO_PROPS.whiteTeamRanks)

  if (blackRanks == null) {
    let br = getRootProperty(tree, 'BR')
    blackRanks = br != null ? [br] : []
  }

  if (whiteRanks == null) {
    let wr = getRootProperty(tree, 'WR')
    whiteRanks = wr != null ? [wr] : []
  }

  return {
    teamSize: n,
    players: createPlayers(n, {blackNames, whiteNames, blackRanks, whiteRanks}),
  }
}

// Returns a new tree with the team configuration written to the root node.
// Passing teamSize <= 1 strips all pair Go properties, restoring a plain
// two-player game.
export function setTeamInfo(tree, {teamSize, players = null} = {}) {
  let n = normalizeTeamSize(teamSize)
  if (players == null) players = createPlayers(n)

  let blackPlayers = getTeamPlayers(players, 0)
  let whitePlayers = getTeamPlayers(players, 1)

  return tree.mutate((draft) => {
    let rootId = draft.root.id

    if (n <= 1) {
      for (let prop of rootCustomProps) {
        draft.removeProperty(rootId, prop)
      }

      return
    }

    let blackNames = blackPlayers.map((player) => player.name || '')
    let whiteNames = whitePlayers.map((player) => player.name || '')
    let blackRanks = blackPlayers.map((player) => player.rank || '')
    let whiteRanks = whitePlayers.map((player) => player.rank || '')

    draft.updateProperty(rootId, PAIR_GO_PROPS.teamSize, [String(n)])
    draft.updateProperty(rootId, PAIR_GO_PROPS.blackTeamNames, blackNames)
    draft.updateProperty(rootId, PAIR_GO_PROPS.whiteTeamNames, whiteNames)

    if (blackRanks.some((rank) => rank !== '')) {
      draft.updateProperty(rootId, PAIR_GO_PROPS.blackTeamRanks, blackRanks)
    } else {
      draft.removeProperty(rootId, PAIR_GO_PROPS.blackTeamRanks)
    }

    if (whiteRanks.some((rank) => rank !== '')) {
      draft.updateProperty(rootId, PAIR_GO_PROPS.whiteTeamRanks, whiteRanks)
    } else {
      draft.removeProperty(rootId, PAIR_GO_PROPS.whiteTeamRanks)
    }

    // Keep standard properties in sync so other SGF software shows
    // something sensible

    let joinedBlack = blackNames.filter((name) => name !== '').join(' + ')
    let joinedWhite = whiteNames.filter((name) => name !== '').join(' + ')

    if (joinedBlack !== '') draft.updateProperty(rootId, 'PB', [joinedBlack])
    if (joinedWhite !== '') draft.updateProperty(rootId, 'PW', [joinedWhite])

    if (blackRanks[0]) draft.updateProperty(rootId, 'BR', [blackRanks[0]])
    if (whiteRanks[0]) draft.updateProperty(rootId, 'WR', [whiteRanks[0]])
  })
}

// Number of moves (B/W properties) played along the path from the root
// to the given node.
export function getMoveCount(tree, id) {
  let count = 0

  for (let node of tree.listNodesVertically(id, -1, {})) {
    if (node.data.B != null || node.data.W != null) count++
  }

  return count
}

// Seat of the player whose turn it is at the given tree position.
export function getCurrentSeat(tree, id) {
  let {teamSize} = getTeamInfo(tree)

  return getSeatForMoveNumber(getMoveCount(tree, id) + 1, teamSize)
}

// Seat of the player who played the move stored on the given node,
// or null if not recorded.
export function getSeatForNode(node) {
  if (node == null) return null

  let values = node.data[PAIR_GO_PROPS.moveSeat]
  if (values == null) return null

  let seat = parseInt(values[0], 10)
  return isNaN(seat) ? null : seat
}

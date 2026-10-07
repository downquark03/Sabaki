// Pure rotation logic for pair Go / team Go (2n players, n:n).
//
// Seats are numbered 0..2n-1: seats 0..n-1 form the black team,
// seats n..2n-1 form the white team. Play follows the standard pair Go
// rotation: B1, W1, B2, W2, ..., Bn, Wn, B1, ...

export const MIN_TEAM_SIZE = 1
export const MAX_TEAM_SIZE = 16

export function normalizeTeamSize(value) {
  let n = Math.round(+value)

  if (isNaN(n)) return MIN_TEAM_SIZE

  return Math.max(MIN_TEAM_SIZE, Math.min(MAX_TEAM_SIZE, n))
}

export function createPlayers(
  teamSize = 1,
  {blackNames = [], whiteNames = [], blackRanks = [], whiteRanks = []} = {},
) {
  let n = normalizeTeamSize(teamSize)
  let players = []

  for (let team = 0; team <= 1; team++) {
    let names = team === 0 ? blackNames : whiteNames
    let ranks = team === 0 ? blackRanks : whiteRanks

    for (let i = 0; i < n; i++) {
      players.push({
        seat: team * n + i,
        team, // 0 = black team, 1 = white team
        seatInTeam: i,
        name: names[i] || '',
        rank: ranks[i] || '',
        type: 'human', // 'human' | 'engine'
        syncerId: null,
      })
    }
  }

  return players
}

// moveNumber is 1-based: the first move of the game has moveNumber 1.
// Returns the seat (0..2n-1) of the player who plays that move.
export function getSeatForMoveNumber(moveNumber, teamSize = 1) {
  let n = normalizeTeamSize(teamSize)
  let k = Math.max(1, Math.round(moveNumber))
  let isBlack = k % 2 === 1
  let seatInTeam = Math.floor((k - 1) / 2) % n

  return isBlack ? seatInTeam : n + seatInTeam
}

// Returns 1 for black team seats, -1 for white team seats.
export function getColorForSeat(seat, teamSize = 1) {
  let n = normalizeTeamSize(teamSize)

  return seat >= 0 && seat < n ? 1 : -1
}

// The rotation order of seats: [0, n, 1, n+1, 2, n+2, ...]
export function getSeatSequence(teamSize = 1) {
  let n = normalizeTeamSize(teamSize)
  let sequence = []

  for (let i = 0; i < n; i++) {
    sequence.push(i, n + i)
  }

  return sequence
}

export function getNextSeat(seat, teamSize = 1) {
  let sequence = getSeatSequence(teamSize)
  let index = sequence.indexOf(seat)

  if (index < 0) return sequence[0]

  return sequence[(index + 1) % sequence.length]
}

export function getPlayerForSeat(players, seat) {
  return players.find((player) => player.seat === seat) || null
}

export function getTeamPlayers(players, team) {
  return players
    .filter((player) => player.team === team)
    .sort((a, b) => a.seatInTeam - b.seatInTeam)
}

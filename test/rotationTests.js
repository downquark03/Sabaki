import assert from 'assert'

import {
  createPlayers,
  getColorForSeat,
  getNextSeat,
  getPlayerForSeat,
  getSeatForMoveNumber,
  getSeatSequence,
  getTeamPlayers,
  normalizeTeamSize,
} from '../src/modules/rotation.js'

describe('normalizeTeamSize', () => {
  it('clamps to at least 1', () => {
    assert.strictEqual(normalizeTeamSize(0), 1)
    assert.strictEqual(normalizeTeamSize(-3), 1)
  })

  it('clamps to at most 16', () => {
    assert.strictEqual(normalizeTeamSize(100), 16)
  })

  it('handles invalid input', () => {
    assert.strictEqual(normalizeTeamSize('abc'), 1)
    assert.strictEqual(normalizeTeamSize(null), 1)
  })

  it('rounds fractional values', () => {
    assert.strictEqual(normalizeTeamSize(2.6), 3)
  })
})

describe('createPlayers', () => {
  it('creates 2n players, black team first', () => {
    let players = createPlayers(2)

    assert.strictEqual(players.length, 4)
    assert.deepStrictEqual(
      players.map((p) => [p.seat, p.team, p.seatInTeam]),
      [
        [0, 0, 0],
        [1, 0, 1],
        [2, 1, 0],
        [3, 1, 1],
      ],
    )
  })

  it('creates two players for team size 1 (classic game)', () => {
    let players = createPlayers(1)

    assert.strictEqual(players.length, 2)
    assert.strictEqual(players[0].team, 0)
    assert.strictEqual(players[1].team, 1)
  })

  it('assigns names and ranks per seat', () => {
    let players = createPlayers(2, {
      blackNames: ['Alice', 'Bob'],
      whiteNames: ['Carol'],
      blackRanks: ['3d', '1d'],
    })

    assert.strictEqual(players[0].name, 'Alice')
    assert.strictEqual(players[1].name, 'Bob')
    assert.strictEqual(players[2].name, 'Carol')
    assert.strictEqual(players[3].name, '')
    assert.strictEqual(players[1].rank, '1d')
    assert.strictEqual(players[3].rank, '')
  })

  it('defaults every player to human with no engine attached', () => {
    for (let player of createPlayers(3)) {
      assert.strictEqual(player.type, 'human')
      assert.strictEqual(player.syncerId, null)
    }
  })
})

describe('getSeatForMoveNumber', () => {
  it('alternates colors within each round for n = 2', () => {
    // B1, W1, B2, W2, B1, W1, ... -> seats 0, 2, 1, 3, 0, 2, ...
    assert.deepStrictEqual(
      [1, 2, 3, 4, 5, 6, 7, 8].map((k) => getSeatForMoveNumber(k, 2)),
      [0, 2, 1, 3, 0, 2, 1, 3],
    )
  })

  it('cycles through all n seats per team for n = 3', () => {
    assert.deepStrictEqual(
      [1, 2, 3, 4, 5, 6, 7].map((k) => getSeatForMoveNumber(k, 3)),
      [0, 3, 1, 4, 2, 5, 0],
    )
  })

  it('reduces to plain alternation for n = 1', () => {
    assert.deepStrictEqual(
      [1, 2, 3, 4].map((k) => getSeatForMoveNumber(k, 1)),
      [0, 1, 0, 1],
    )
  })

  it('never assigns two consecutive moves to the same seat', () => {
    for (let n = 1; n <= 8; n++) {
      for (let k = 1; k <= 4 * n; k++) {
        assert.notStrictEqual(
          getSeatForMoveNumber(k, n),
          getSeatForMoveNumber(k + 1, n),
        )
      }
    }
  })
})

describe('getColorForSeat', () => {
  it('assigns black to the first n seats, white to the rest', () => {
    assert.strictEqual(getColorForSeat(0, 2), 1)
    assert.strictEqual(getColorForSeat(1, 2), 1)
    assert.strictEqual(getColorForSeat(2, 2), -1)
    assert.strictEqual(getColorForSeat(3, 2), -1)
  })
})

describe('getSeatSequence / getNextSeat', () => {
  it('interleaves the two teams', () => {
    assert.deepStrictEqual(getSeatSequence(3), [0, 3, 1, 4, 2, 5])
  })

  it('walks the whole sequence cyclically', () => {
    let seat = 0
    let visited = [seat]

    for (let i = 0; i < 6; i++) {
      seat = getNextSeat(seat, 3)
      visited.push(seat)
    }

    assert.deepStrictEqual(visited, [0, 3, 1, 4, 2, 5, 0])
  })

  it('recovers from an unknown seat', () => {
    assert.strictEqual(getNextSeat(99, 2), 0)
  })
})

describe('getPlayerForSeat / getTeamPlayers', () => {
  let players = createPlayers(2, {blackNames: ['Alice', 'Bob']})

  it('finds the player occupying a seat', () => {
    assert.strictEqual(getPlayerForSeat(players, 1).name, 'Bob')
    assert.strictEqual(getPlayerForSeat(players, 99), null)
  })

  it('lists team members in seat order', () => {
    assert.deepStrictEqual(
      getTeamPlayers(players, 0).map((p) => p.name),
      ['Alice', 'Bob'],
    )
    assert.strictEqual(getTeamPlayers(players, 1).length, 2)
  })
})

import assert from 'assert'

import * as sgf from '@sabaki/sgf'

import * as gametree from '../src/modules/gametree.js'
import * as pairgo from '../src/modules/pairgo.js'
import {createPlayers} from '../src/modules/rotation.js'
import {getId} from '../src/modules/utils.js'

function playMove(tree, parentId, color, vertex) {
  let nextId

  let newTree = tree.mutate((draft) => {
    nextId = draft.appendNode(parentId, {[color]: [vertex]})
  })

  return [newTree, nextId]
}

describe('pairgo.getTeamInfo', () => {
  it('treats a plain game tree as a classic 1:1 game', () => {
    let tree = gametree.new().mutate((draft) => {
      draft.updateProperty(draft.root.id, 'PB', ['Alice'])
      draft.updateProperty(draft.root.id, 'PW', ['Bob'])
      draft.updateProperty(draft.root.id, 'BR', ['3d'])
    })

    let {teamSize, players} = pairgo.getTeamInfo(tree)

    assert.strictEqual(teamSize, 1)
    assert.strictEqual(players.length, 2)
    assert.strictEqual(players[0].name, 'Alice')
    assert.strictEqual(players[0].rank, '3d')
    assert.strictEqual(players[1].name, 'Bob')
  })
})

describe('pairgo.setTeamInfo', () => {
  it('writes team configuration to the root and round-trips', () => {
    let tree = gametree.new()
    let players = createPlayers(2, {
      blackNames: ['Alice', 'Bob'],
      whiteNames: ['Carol', 'Dave'],
      blackRanks: ['3d', '1d'],
    })

    tree = pairgo.setTeamInfo(tree, {teamSize: 2, players})

    let info = pairgo.getTeamInfo(tree)

    assert.strictEqual(info.teamSize, 2)
    assert.deepStrictEqual(
      info.players.map((p) => p.name),
      ['Alice', 'Bob', 'Carol', 'Dave'],
    )
    assert.deepStrictEqual(
      info.players.map((p) => p.rank),
      ['3d', '1d', '', ''],
    )
  })

  it('keeps standard PB/PW in sync for other SGF software', () => {
    let tree = gametree.new()
    let players = createPlayers(2, {
      blackNames: ['Alice', 'Bob'],
      whiteNames: ['Carol', 'Dave'],
    })

    tree = pairgo.setTeamInfo(tree, {teamSize: 2, players})

    assert.strictEqual(tree.root.data.PB[0], 'Alice + Bob')
    assert.strictEqual(tree.root.data.PW[0], 'Carol + Dave')
  })

  it('strips pair Go properties when resetting to team size 1', () => {
    let tree = gametree.new()
    tree = pairgo.setTeamInfo(tree, {
      teamSize: 3,
      players: createPlayers(3),
    })
    tree = pairgo.setTeamInfo(tree, {teamSize: 1})

    for (let prop of ['XS', 'XPB', 'XPW', 'XRB', 'XRW']) {
      assert.strictEqual(tree.root.data[prop], undefined)
    }

    assert.strictEqual(pairgo.getTeamInfo(tree).teamSize, 1)
  })
})

describe('pairgo.getMoveCount / getCurrentSeat', () => {
  it('counts moves along the path', () => {
    let tree = gametree.new()
    let id = tree.root.id

    assert.strictEqual(pairgo.getMoveCount(tree, id), 0)
    ;[tree, id] = playMove(tree, id, 'B', 'dd')
    ;[tree, id] = playMove(tree, id, 'W', 'pp')
    ;[tree, id] = playMove(tree, id, 'B', '') // pass

    assert.strictEqual(pairgo.getMoveCount(tree, id), 3)
  })

  it('yields the seat of the player to move next', () => {
    let tree = gametree.new()
    tree = pairgo.setTeamInfo(tree, {teamSize: 2, players: createPlayers(2)})

    let id = tree.root.id

    // Rotation for n = 2: B1 (0), W1 (2), B2 (1), W2 (3), B1 (0), ...
    let expectedSeats = [0, 2, 1, 3, 0]

    for (let i = 0; i < expectedSeats.length; i++) {
      assert.strictEqual(pairgo.getCurrentSeat(tree, id), expectedSeats[i])

      let color = i % 2 === 0 ? 'B' : 'W'
      ;[tree, id] = playMove(tree, id, color, 'dd')
    }
  })

  it('reduces to plain alternation for classic games', () => {
    let tree = gametree.new()
    let id = tree.root.id

    assert.strictEqual(pairgo.getCurrentSeat(tree, id), 0)
    ;[tree, id] = playMove(tree, id, 'B', 'dd')
    assert.strictEqual(pairgo.getCurrentSeat(tree, id), 1)
  })
})

describe('pairgo.getSeatForNode', () => {
  it('reads the recorded seat from a node', () => {
    let tree = gametree.new()
    let id

    let newTree = tree.mutate((draft) => {
      id = draft.appendNode(draft.root.id, {B: ['dd']})
      draft.updateProperty(id, pairgo.PAIR_GO_PROPS.moveSeat, ['2'])
    })

    assert.strictEqual(pairgo.getSeatForNode(newTree.get(id)), 2)
  })

  it('returns null when no seat is recorded', () => {
    let tree = gametree.new()

    assert.strictEqual(pairgo.getSeatForNode(tree.root), null)
  })
})

describe('pairgo SGF round-trip', () => {
  it('survives stringification and parsing', () => {
    let tree = gametree.new()
    let players = createPlayers(2, {
      blackNames: ['Alice', 'Bob'],
      whiteNames: ['Carol', 'Dave'],
    })

    tree = pairgo.setTeamInfo(tree, {teamSize: 2, players})

    let id
    let newTree = tree.mutate((draft) => {
      id = draft.appendNode(draft.root.id, {B: ['dd']})
      draft.updateProperty(id, pairgo.PAIR_GO_PROPS.moveSeat, ['0'])
    })

    let content = sgf.stringify([newTree.root], {linebreak: ''})
    let [parsedRoot] = sgf.parse(content, {getId})
    let parsedTree = gametree.new({getId, root: parsedRoot})

    let info = pairgo.getTeamInfo(parsedTree)

    assert.strictEqual(info.teamSize, 2)
    assert.deepStrictEqual(
      info.players.map((p) => p.name),
      ['Alice', 'Bob', 'Carol', 'Dave'],
    )
    assert.strictEqual(pairgo.getSeatForNode(parsedTree.root.children[0]), 0)
  })
})

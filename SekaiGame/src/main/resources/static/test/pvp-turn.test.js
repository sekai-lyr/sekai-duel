import test from "node:test";
import assert from "node:assert/strict";

global.location = { protocol: "http:", host: "localhost:8091" };

const { PvPClient } = await import("../js/pvp.js");

test("end turn is sent atomically with final state and a request id", () => {
    const client = new PvPClient();
    const sent = [];
    client.ws = {
        readyState: 1,
        send(payload) { sent.push(JSON.parse(payload)); },
    };
    const state = { turn: 4, currentPlayerIndex: 1 };

    client.endTurn(state, "turn_4_test");

    assert.deepEqual(sent, [{
        type: "end_turn",
        state,
        requestId: "turn_4_test",
    }]);
});

test("turn acknowledgement forwards its request id", () => {
    const client = new PvPClient();
    let received = null;
    client.onTurnChange = (turn, requestId) => { received = { turn, requestId }; };

    client._handleMessage({ type: "turn_changed", turn: 1, requestId: "turn_4_test" });

    assert.deepEqual(received, { turn: 1, requestId: "turn_4_test" });
});

test("heartbeat keeps an idle websocket active", () => {
    const client = new PvPClient();
    const sent = [];
    client.ws = { readyState: 1, send(payload) { sent.push(JSON.parse(payload)); } };
    assert.equal(client.send({ type: "ping", at: 123 }), true);
    assert.deepEqual(sent, [{ type: "ping", at: 123 }]);
});

test("end turn reports failure when websocket is already closed", () => {
    const client = new PvPClient();
    client.ws = { readyState: 3, send() { throw new Error("must not send"); } };
    assert.equal(client.endTurn({ turn: 2 }, "request-2"), false);
});

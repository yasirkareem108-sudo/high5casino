// Runs async tasks that share a key strictly one after another (tasks with different keys
// still run in parallel). Used so that per-conversation database updates AND the socket events
// announcing them stay in order — otherwise two quick messages can resolve out of order and the
// admin's unread count would briefly go backwards.
const tails = new Map();

function runExclusive(key, task) {
  const previous = tails.get(key) || Promise.resolve();
  const run = previous.then(() => task());
  const tail = run.catch(() => {});
  tails.set(key, tail);
  tail.then(() => {
    if (tails.get(key) === tail) tails.delete(key);
  });
  return run;
}

module.exports = { runExclusive };

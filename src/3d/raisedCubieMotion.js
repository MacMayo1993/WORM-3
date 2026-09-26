// Only moving/raised cubies are present. Scene cleanup removes by owner identity.
// The overview camera reads the extent without rescanning an entire Mega board.
const raised = new Map();
export function publishRaisedCubie(owner, amount) {
  if (amount > 0.0001) raised.set(owner, amount);
  else raised.delete(owner);
}
export const removeRaisedCubie = owner => raised.delete(owner);
export function raisedCubieExtent() {
  let amount = 0;
  for (const value of raised.values()) amount = Math.max(amount, value);
  return Math.min(1, amount);
}

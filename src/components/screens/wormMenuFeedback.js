import { feel, resumeFeel } from '../../utils/feel.js';

// Click also covers keyboard activation; the shared feel service honors settings.
export function wormMenuFeedback() {
  resumeFeel();
  feel('uiKey');
}

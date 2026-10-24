/**
 * ReceiptVault — Android Haptic Feedback Engine
 * Implements nuanced vibration patterns mapped to standard Android haptic constants / interactions:
 * - lightClick / selection: 10ms
 * - cardExpansion: [12, 25, 15]
 * - scanSuccess: [20, 50, 20, 80, 40]
 * - claimSubmission: [40, 60, 40, 100, 60]
 * - heavyImpact: 35ms
 */

export type HapticStyle =
  | 'light'
  | 'medium'
  | 'heavy'
  | 'cardExpansion'
  | 'scanSuccess'
  | 'claimSubmission'
  | 'error';

export function triggerAndroidHaptic(style: HapticStyle = 'light') {
  try {
    if (typeof navigator === 'undefined' || !navigator.vibrate) return;

    switch (style) {
      case 'light':
        navigator.vibrate(12);
        break;
      case 'medium':
        navigator.vibrate(22);
        break;
      case 'heavy':
        navigator.vibrate(35);
        break;
      case 'cardExpansion':
        navigator.vibrate([12, 25, 15]);
        break;
      case 'scanSuccess':
        navigator.vibrate([20, 50, 20, 80, 40]);
        break;
      case 'claimSubmission':
        navigator.vibrate([40, 60, 40, 100, 60]);
        break;
      case 'error':
        navigator.vibrate([50, 30, 50, 30, 50]);
        break;
      default:
        navigator.vibrate(12);
    }
  } catch {
    // ignore if vibration blocked or unsupported
  }
}

export function triggerHaptic(msOrStyle: number | HapticStyle = 12) {
  if (typeof msOrStyle === 'number') {
    try {
      if (typeof navigator !== 'undefined' && navigator.vibrate) {
        navigator.vibrate(msOrStyle);
      }
    } catch {
      // ignore
    }
  } else {
    triggerAndroidHaptic(msOrStyle);
  }
}

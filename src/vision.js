// Grabs what the camera sees (with your AR objects) as a small JPEG for Gemini.
let IM = null;
try {
  // eslint-disable-next-line global-require
  IM = require('expo-image-manipulator');
} catch (e) {
  IM = null;
}

export async function snapshot(navRef) {
  const nav = navRef && navRef.current;
  if (!nav) return null;
  const take =
    (nav.arSceneNavigator && nav.arSceneNavigator.takeScreenshot) ||
    (nav._takeScreenshot && nav._takeScreenshot.bind(nav));
  if (!take) return null;
  const res = await take(`myview_${Date.now()}`, false);
  let uri = res && (res.url || res.uri);
  if (!uri) return null;
  if (!/^file:|^ph:|^assets-library:/.test(uri)) uri = `file://${uri}`;
  if (!IM) return null;
  if (IM.manipulateAsync) {
    const out = await IM.manipulateAsync(uri, [{ resize: { width: 768 } }], {
      compress: 0.6,
      format: (IM.SaveFormat && IM.SaveFormat.JPEG) || 'jpeg',
      base64: true,
    });
    return out && out.base64 ? out.base64 : null;
  }
  if (IM.ImageManipulator) {
    const img = await IM.ImageManipulator.manipulate(uri).resize({ width: 768 }).renderAsync();
    const out = await img.saveAsync({ compress: 0.6, format: 'jpeg', base64: true });
    return out && out.base64 ? out.base64 : null;
  }
  return null;
}

const loadedScripts = new Set();

export const loadScript = (src, isLoaded) =>
  new Promise((resolve, reject) => {
    if (loadedScripts.has(src) || (isLoaded && isLoaded())) {
      resolve();
      return;
    }
    const script = document.createElement("script");
    script.src = src;
    script.async = true;
    script.onload = () => {
      loadedScripts.add(src);
      resolve();
    };
    script.onerror = () => {
      reject(new Error(`Failed to load script: ${src}`));
    };
    document.head.appendChild(script);
  });

export default loadScript;

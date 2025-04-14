function createAbortSignal(timeoutMs = 20000) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => {
      controller.abort();
      console.log(`Aborted MongoDB operation after ${timeoutMs}ms`);
  }, timeoutMs);

  return {
      signal: controller.signal,
      clear: () => clearTimeout(timeoutId),
  };
}

module.exports = { createAbortSignal };
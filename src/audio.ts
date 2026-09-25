export interface AudioSession {
  context: AudioContext;
  stream: MediaStream;
  analyser: AnalyserNode;
  source: MediaStreamAudioSourceNode;
  stop(): void;
}

export async function startAudioSession(): Promise<AudioSession> {
  const context = new AudioContext({ latencyHint: 'interactive' });
  await context.resume();

  try {
    const stream = await navigator.mediaDevices.getUserMedia({
      audio: {
        echoCancellation: false,
        noiseSuppression: false,
        autoGainControl: false,
      },
    });
    const source = context.createMediaStreamSource(stream);
    const analyser = context.createAnalyser();
    analyser.fftSize = 16384;
    analyser.smoothingTimeConstant = 0.32;
    analyser.minDecibels = -100;
    analyser.maxDecibels = -10;
    source.connect(analyser);
    return {
      context,
      stream,
      analyser,
      source,
      stop() {
        source.disconnect();
        stream.getTracks().forEach((track) => track.stop());
        void context.close();
      },
    };
  } catch (error) {
    await context.close();
    throw error;
  }
}

export function validateComposition(value) {
  if(!value || typeof value!=='object')throw new Error('Motion code must export composition metadata');
  const {width,height,fps,duration}=value;
  if(!Number.isInteger(width) || width<320 || width>3840 || width%2 || !Number.isInteger(height) || height<180 || height>3840 || height%2)throw new Error('Video dimensions must be even integers (width 320–3840, height 180–3840)');
  if(!Number.isInteger(fps) || fps<1 || fps>60)throw new Error('FPS must be an integer from 1 to 60');
  if(!Number.isFinite(duration) || duration<=0 || duration>120)throw new Error('Duration must be greater than zero and at most 120 seconds');
  const frameCount=Math.round(duration*fps);
  if(frameCount<1 || Math.abs(duration*fps-frameCount)>1e-6)throw new Error('Duration must contain an exact whole number of frames');
  return {width,height,fps,duration,frameCount};
}

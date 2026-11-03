# Just Make Bread — Stage 1 audio manifest

The current runtime payload contains three independently verified CC0 sounds:

- `pickup-mouth-pop.wav` — “Mouth pop 2” by hollandm, Freesound 691907
  - License: CC0-1.0; commercial use, modification, and public distribution allowed
  - SHA-256: `D604FFB77E3E794886BD3AEF0DAF54AB7AF8CA980712997B50A5567A7EF7DC43`
  - Runtime gain: -10 dB before the user-controlled SFX master volume
- `stage_complete_a.wav` — “Pleasing Bell” by OGA Spring Spring
  - License: CC0; attribution is not legally required for runtime serving
  - SHA-256: `3C851939CCF9146E49C1BE0272386FDCA1B1442BB034A5E6DCDFB3E0E144A411`
  - Format: WAV PCM, 44.1 kHz, 16-bit, stereo, 109,392 bytes
  - Runtime gain: 0 dB before the user-controlled SFX master volume
  - Source measurement: peak -24.3275735 dBFS; RMS -39.1983646 dBFS
- `deposit_small_latch.wav` — “SmallLatchClick” by chewiesmissus, Freesound 213396
  - Original license: CC0; original source SHA-256 `520368524FFFE28DB7549A7479B7EC1469AA32AF5501F6CAA2757221F34930C7`
  - Runtime derivative SHA-256: `DA6DD440770196C2EFFC08C63ACAA8BB0D8BA6263CAB46E5D36B91069DDE2E9E`
  - Format: WAV PCM, 48 kHz, 16-bit, stereo, 77,840 bytes
  - Derivative recipe: per-channel full-file mean subtraction; exact pair-average 96 kHz to 48 kHz; 2 ms half-cosine fade-in; 12 ms half-cosine fade-out; PCM16; no normalization
  - Runtime gain: 0 dB before the user-controlled SFX master volume
The active transport events are `material-picked-up`, `stack-increased`, live
authoritative `material-deposited` with `cause=manual`, and authoritative
`stage-completed`. Each distinct event id is admitted once. Manual deposits are
count-independent and use a deposit voice cap of one with an 8 ms fade tail.
Token-output events remain gameplay-only and are silent while their validated
runtime cue is on hold. Catch-up, presentation-derived, replay, invalid,
failed, and lifecycle events remain silent; gameplay and token timing are not
owned by audio.

The Adobe-selected raw deposit/output sources remain outside `public/` and are
not loaded. They are not replaced by a second runtime manager or a pipe-only
cue. Human listening and final volume approval are still pending.

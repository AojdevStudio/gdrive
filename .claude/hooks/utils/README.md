# Utils - Shared Utilities

This directory contains shared utilities and helper functions used by various hooks.

## Structure:

- **llm/**: Language model utilities
  - anth.py: Anthropic API utilities
  - oai.py: OpenAI API utilities
- **tts/**: Text-to-speech utilities
  - elevenlabs_tts.py: ElevenLabs TTS integration
  - openai_tts.py: OpenAI TTS integration
  - pyttsx3_tts.py: Local TTS using pyttsx3

## Usage:

These utilities are imported and used by various hooks. They provide common functionality like:

- API integrations
- Text-to-speech capabilities
- Shared helper functions
- Common validation logic

## Note:

Do not run these files directly. They are meant to be imported by hooks.

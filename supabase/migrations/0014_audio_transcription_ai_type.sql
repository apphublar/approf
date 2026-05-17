-- Allow audio transcription usage logs/reservations.

alter type public.ai_generation_type add value if not exists 'audio_transcription';

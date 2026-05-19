-- Tipos de geração pedagógica usados pelo app (reserva de IA e logs).

alter type public.ai_generation_type add value if not exists 'class_diary';
alter type public.ai_generation_type add value if not exists 'weekly_planning';
alter type public.ai_generation_type add value if not exists 'daily_lesson_plan';
alter type public.ai_generation_type add value if not exists 'pedagogical_project';
alter type public.ai_generation_type add value if not exists 'specialist_referral';
alter type public.ai_generation_type add value if not exists 'parents_meeting_record';

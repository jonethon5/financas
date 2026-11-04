-- Avisos automáticos: 5 dias antes e no dia do vencimento (antes: 3, 1 e 0).
-- Quem ainda estava no padrão antigo passa para o novo.
alter table public.members alter column reminder_days set default '{5,0}';

update public.members set reminder_days = '{5,0}' where reminder_days = '{3,1,0}';

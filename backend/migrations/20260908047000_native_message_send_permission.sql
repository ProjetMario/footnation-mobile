CREATE POLICY native_message_send_permission ON public.messages AS RESTRICTIVE
FOR INSERT TO authenticated WITH CHECK (
 sender_id=auth.uid()
 AND NOT EXISTS(SELECT 1 FROM public.user_blocks b WHERE
  (b.blocker_id=sender_id AND b.blocked_id=receiver_id) OR
  (b.blocker_id=receiver_id AND b.blocked_id=sender_id))
 AND (
  EXISTS(SELECT 1 FROM public.connections c WHERE c.status='accepted' AND
   ((c.user_id=sender_id AND c.connected_user_id=receiver_id) OR
    (c.user_id=receiver_id AND c.connected_user_id=sender_id)))
  OR EXISTS(SELECT 1 FROM public.profiles p WHERE p.id=receiver_id AND p.is_admin=true)
 )
);

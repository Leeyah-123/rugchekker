export interface TwitterWebhookEvent {
  for_user_id: string;
  tweet_create_events?: TweetCreateEvent[];
  direct_message_events?: DirectMessageEvent[];
}

export interface TweetCreateEvent {
  id_str: string;
  text: string;
  user: {
    id_str: string;
    screen_name: string;
  };
  in_reply_to_status_id_str: string | null;
}

export interface DirectMessageEvent {
  id: string;
  message_create: {
    sender_id: string;
    message_data: {
      text: string;
      attachment?: {
        media: {
          url: string;
          type: string;
        };
      };
    };
  };
}

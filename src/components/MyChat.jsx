import { ChatKit, useChatKit } from '@openai/chatkit-react';
import { useState } from 'react';

export function MyChat() {
  const [error, setError] = useState(null);
  const [isLoading, setIsLoading] = useState(true);

  const { control } = useChatKit({
    api: {
      async getClientSecret(existing) {
        try {
          // If we have an existing secret, try to refresh it
          if (existing) {
            console.log('Refreshing existing session...');
            const refreshRes = await fetch('https://doah-widget.vercel.app/api/chatkit/refresh', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({ client_secret: existing })
            });

            if (refreshRes.ok) {
              const { client_secret } = await refreshRes.json();
              console.log('Session refreshed successfully');
              setIsLoading(false);
              return client_secret;
            } else {
              console.log('Refresh failed, creating new session...');
            }
          }

          // Create new session
          console.log('Creating new session...');
          const sessionRes = await fetch('https://doah-widget.vercel.app/api/chatkit/session', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({ 
              user: 'guest-' + Date.now() 
            })
          });

          if (!sessionRes.ok) {
            const errorData = await sessionRes.json();
            throw new Error(errorData?.error?.message || 'Failed to create session');
          }

          const { client_secret } = await sessionRes.json();
          console.log('Session created successfully');
          setIsLoading(false);
          setError(null);
          return client_secret;

        } catch (err) {
          console.error('ChatKit session error:', err);
          setError(err.message);
          setIsLoading(false);
          throw err;
        }
      },
    },
  });

  return (
    <div style={{
      background: 'white',
      borderRadius: '12px',
      boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)',
      overflow: 'hidden',
      width: '100%',
      maxWidth: '400px',
      display: 'flex',
      flexDirection: 'column'
    }}>
      <div style={{
        padding: '20px',
        background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
        color: 'white'
      }}>
        <h1 style={{ fontSize: '24px', fontWeight: '600', marginBottom: '8px' }}>
          My ChatKit Assistant
        </h1>
        {isLoading && <p style={{ fontSize: '14px' }}>Initializing...</p>}
        {error && <p style={{ fontSize: '14px', color: '#ffcccc' }}>Error: {error}</p>}
      </div>
      
      <ChatKit 
        control={control} 
        style={{ height: '600px', width: '100%' }}
      />
    </div>
  );
}
import { useEffect, useRef } from 'react';

export interface ConsoleMessage {
  type: 'info' | 'warn' | 'error' | 'success';
  message: string;
  timestamp: Date;
}

interface ConsoleProps {
  messages: ConsoleMessage[];
}

export function Console({ messages }: ConsoleProps) {
  const consoleEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    consoleEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const getMessageClass = (type: string) => {
    switch (type) {
      case 'error':
        return 'console-message-error';
      case 'warn':
        return 'console-message-warn';
      case 'success':
        return 'console-message-success';
      default:
        return 'console-message-info';
    }
  };

  const getMessageIcon = (type: string) => {
    switch (type) {
      case 'error':
        return '✗';
      case 'warn':
        return '⚠';
      case 'success':
        return '✓';
      default:
        return '→';
    }
  };

  return (
    <div className="console">
      <div className="console-header">
        <span className="console-title">Parse Console</span>
        <span className="console-count">{messages.length} messages</span>
      </div>
      <div className="console-content">
        {messages.length === 0 ? (
          <div className="console-empty">
            <p>Waiting for file to parse...</p>
          </div>
        ) : (
          messages.map((msg, idx) => (
            <div key={idx} className={`console-message ${getMessageClass(msg.type)}`}>
              <span className="console-icon">{getMessageIcon(msg.type)}</span>
              <span className="console-time">
                {msg.timestamp.toLocaleTimeString('en-US', {
                  hour12: false,
                  hour: '2-digit',
                  minute: '2-digit',
                  second: '2-digit'
                })}.{msg.timestamp.getMilliseconds().toString().padStart(3, '0')}
              </span>
              <span className="console-text">{msg.message}</span>
            </div>
          ))
        )}
        <div ref={consoleEndRef} />
      </div>
    </div>
  );
}

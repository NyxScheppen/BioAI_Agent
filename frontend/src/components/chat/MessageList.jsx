import ReactMarkdown from 'react-markdown'

function MessageList({
  messages,
  isLoading,
  loadingText,
  normalizeToAbsoluteFileUrl,
  messagesEndRef
}) {
  return (
    <div className="chat-window">
      {(messages || []).map((msg, index) => (
        <div key={index} className={`message-wrapper ${msg.role}`}>
          <div className={`message-bubble ${msg.role}`}>
            <ReactMarkdown
              components={{
                a: ({ href, children }) => (
                  <a
                    href={normalizeToAbsoluteFileUrl(href)}
                    target="_blank"
                    rel="noreferrer"
                    download
                  >
                    {children}
                  </a>
                ),
                img: ({ src, alt }) => (
                  <img
                    src={normalizeToAbsoluteFileUrl(src)}
                    alt={alt || 'result'}
                    style={{
                      maxWidth: '100%',
                      borderRadius: '8px',
                      marginTop: '8px'
                    }}
                  />
                )
              }}
            >
              {msg.content}
            </ReactMarkdown>
          </div>
        </div>
      ))}

      {isLoading && (
        <div className="message-wrapper ai">
          <div className="message-bubble ai thinking-bubble">
            <div className="typing-dots">
              <span></span>
              <span></span>
              <span></span>
            </div>
            <span className="thinking-text">
              {loadingText}
              <span className="thinking-ellipsis">
                <span>.</span>
                <span>.</span>
                <span>.</span>
              </span>
            </span>
          </div>
        </div>
      )}

      <div ref={messagesEndRef} />
    </div>
  )
}

export default MessageList
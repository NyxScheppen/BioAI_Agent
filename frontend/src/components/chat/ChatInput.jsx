import ThemeButton from '../common/ThemeButton'

function ChatInput({
  userInput,
  setUserInput,
  sendMessage,
  isLoading,
  fileInputRef,
  handleFileUpload,
  inputPlaceholder,
  uploadIcon,
  themeStyle
}) {
  return (
    <div className="input-area">
      <div className="input-container">
        <input
          type="file"
          ref={fileInputRef}
          style={{ display: 'none' }}
          multiple
          onChange={handleFileUpload}
        />

        <ThemeButton
          themeStyle={themeStyle}
          onClick={() => fileInputRef.current?.click()}
          disabled={isLoading}
          title="上传文件"
          aria-label="上传文件"
          style={{
            minWidth: '44px',
            height: '44px',
            borderRadius: '12px',
            boxShadow: `0 8px 18px ${themeStyle.primarySoft}`
          }}
        >
          {uploadIcon}
        </ThemeButton>

        <input
          value={userInput}
          onChange={(e) => setUserInput(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && sendMessage()}
          placeholder={inputPlaceholder}
        />

        <ThemeButton
          themeStyle={themeStyle}
          onClick={sendMessage}
          disabled={isLoading}
          style={{
            minWidth: '74px',
            height: '44px',
            borderRadius: '12px',
            boxShadow: `0 8px 18px ${themeStyle.primarySoft}`
          }}
        >
          发送
        </ThemeButton>
      </div>
    </div>
  )
}

export default ChatInput
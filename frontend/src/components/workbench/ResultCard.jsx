import ThemeButton from '../common/ThemeButton'

function ResultCard({ res, added, onAddToSession, themeStyle }) {
  if (res.type === 'plot') {
    return (
      <div className="result-card">
        <h3>{res.title}</h3>
        <div className="result-content">
          <img src={res.content} alt={res.filename || 'Analysis Plot'} />

          <div style={{ marginTop: '10px', display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
            <a
              href={res.rawUrl || res.content}
              target="_blank"
              rel="noreferrer"
              download={res.filename || true}
              style={{
                textDecoration: 'none',
                display: 'inline-flex',
                alignItems: 'center'
              }}
            >
              <ThemeButton themeStyle={themeStyle} variant="secondary">
                下载图片
              </ThemeButton>
            </a>

            <ThemeButton
              themeStyle={themeStyle}
              variant={added ? 'secondary' : 'primary'}
              disabled={added}
              onClick={() => onAddToSession(res)}
            >
              {added ? '已加入会话' : '加入到会话'}
            </ThemeButton>
          </div>
        </div>
      </div>
    )
  }

  if (res.type === 'file') {
    return (
      <div className="result-card">
        <h3>{res.title}</h3>
        <div className="result-content">
          <p style={{ marginBottom: '10px', wordBreak: 'break-all' }}>
            文件名：{res.filename || '未命名文件'}
          </p>

          <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
            <a
              href={res.rawUrl || res.content}
              target="_blank"
              rel="noreferrer"
              download={res.filename || true}
              style={{
                textDecoration: 'none',
                display: 'inline-flex',
                alignItems: 'center'
              }}
            >
              <ThemeButton themeStyle={themeStyle} variant="secondary">
                下载文件
              </ThemeButton>
            </a>

            <ThemeButton
              themeStyle={themeStyle}
              variant={added ? 'secondary' : 'primary'}
              disabled={added}
              onClick={() => onAddToSession(res)}
            >
              {added ? '已加入会话' : '加入到会话'}
            </ThemeButton>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="result-card">
      <h3>{res.title}</h3>
      <div className="result-content">
        <p>{res.content}</p>
      </div>
    </div>
  )
}

export default ResultCard
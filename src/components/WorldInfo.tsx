import { WldWorld } from '../lib/WldParser';

interface WorldInfoProps {
  world: WldWorld | null;
  filename: string;
}

export function WorldInfo({ world, filename }: WorldInfoProps) {
  if (!world) return null;

  return (
    <div className="world-info">
      <div className="info-header">
        <h2>{world.name || 'Unnamed World'}</h2>
        <span className="filename">{filename}</span>
      </div>

      {world.description && (
        <div className="info-section">
          <h3>Description</h3>
          <p>{world.description}</p>
        </div>
      )}

      <div className="info-section">
        <h3>Statistics</h3>
        <div className="stats">
          <div className="stat">
            <span className="label">Entities:</span>
            <span className="value">{world.entities.length}</span>
          </div>
          <div className="stat">
            <span className="label">Brushes:</span>
            <span className="value">{world.brushes.length}</span>
          </div>
          <div className="stat">
            <span className="label">Background Color:</span>
            <div
              className="color-box"
              style={{ backgroundColor: `#${world.backgroundColor.toString(16).padStart(6, '0')}` }}
            />
          </div>
        </div>
      </div>
    </div>
  );
}

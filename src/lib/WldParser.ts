import { BinaryStream } from './BinaryStream';

export interface Vector3 {
  x: number;
  y: number;
  z: number;
}

export interface Placement3D {
  position: Vector3;
  rotation: Vector3;
}

export interface WldEntity {
  id: number;
  className: string;
  placement: Placement3D;
}

export interface WldBrush {
  id: number;
  sectors: WldSector[];
}

export interface WldSector {
  polygons: WldPolygon[];
}

export interface WldPolygon {
  vertices: Vector3[];
  textureMapping?: string;
}

export interface WldWorld {
  name: string;
  description: string;
  backgroundColor: number;
  entities: WldEntity[];
  brushes: WldBrush[];
  spawnFlags: number;
  engineVersion?: string;
  engineBuild?: number;
}

export type LogCallback = (type: 'info' | 'warn' | 'error' | 'success', message: string) => void;

export class WldParser {
  private stream: BinaryStream;
  private log: LogCallback;

  constructor(arrayBuffer: ArrayBuffer, logCallback?: LogCallback) {
    this.stream = new BinaryStream(arrayBuffer);
    this.log = logCallback || (() => {});
  }

  parse(): WldWorld {
    const world: WldWorld = {
      name: '',
      description: '',
      backgroundColor: 0x000000,
      entities: [],
      brushes: [],
      spawnFlags: 0
    };

    try {
      this.log('info', `Starting parse. File size: ${this.stream.getSize()} bytes`);

      this.readEngineVersion(world);

      this.log('info', `Looking for WRLD chunk at position ${this.stream.getPosition()}`);
      const wrldChunk = this.stream.peekChunkID();
      this.log('info', `Found chunk: "${wrldChunk.toString()}"`);

      this.stream.expectChunkID('WRLD');
      this.log('success', 'Found WRLD chunk');

      this.readBrushes(world);

      this.readState(world);

      this.stream.expectChunkID('WEND');
      this.log('success', 'Successfully parsed WLD file');

      return world;
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Unknown error';
      this.log('error', `Parse failed: ${errorMsg}`);
      console.error('Error parsing WLD file:', error);
      throw error;
    }
  }

  private readEngineVersion(world: WldWorld): void {
    try {
      this.log('info', 'Reading engine version header');

      const versionChunk = this.stream.peekChunkID();
      this.log('info', `Version chunk ID: "${versionChunk.toString()}"`);

      if (versionChunk.toString() === 'BUIV') {
        this.stream.expectChunkID('BUIV');
        this.log('info', 'Found BUIV (Build Version) chunk');

        const buildVersion = this.stream.readInt32();
        world.engineBuild = buildVersion;

        this.log('success', `Engine build version: ${buildVersion}`);

        if (this.stream.peekChunkID().toString() === 'VERC') {
          this.stream.expectChunkID('VERC');
          const versionStringLength = this.stream.readInt32();
          if (versionStringLength > 0 && versionStringLength < 1000) {
            world.engineVersion = this.stream.readString(versionStringLength);
            this.log('success', `Engine version: ${world.engineVersion}`);
          }
        }
      } else {
        this.log('warn', 'No engine version header found, file might be older format');
      }
    } catch (error) {
      this.log('warn', 'Could not read engine version, continuing anyway');
    }
  }

  private readBrushes(world: WldWorld): void {
    this.log('info', 'Reading brushes section');

    const nextChunk = this.stream.peekChunkID();
    this.log('info', `Next chunk: "${nextChunk.toString()}"`);

    if (nextChunk.toString() === 'WLIF') {
      this.readWorldInfo(world);
    } else {
      this.log('warn', 'No WLIF chunk found, skipping world info');
    }
  }

  private readWorldInfo(world: WldWorld): void {
    try {
      this.log('info', 'Reading world info (WLIF)');
      this.stream.expectChunkID('WLIF');

      if (this.stream.peekChunkID().toString() === 'DTRS') {
        this.stream.expectChunkID('DTRS');
        this.log('info', 'Found DTRS chunk');
      }

      const nameLength = this.stream.readInt32();
      this.log('info', `Name length: ${nameLength}`);

      if (nameLength > 0 && nameLength < 1000) {
        world.name = this.stream.readString(nameLength);
        this.log('success', `World name: "${world.name}"`);
      }

      world.spawnFlags = this.stream.readUInt32();
      this.log('info', `Spawn flags: 0x${world.spawnFlags.toString(16)}`);

      const descLength = this.stream.readInt32();
      this.log('info', `Description length: ${descLength}`);

      if (descLength > 0 && descLength < 10000) {
        world.description = this.stream.readString(descLength);
        this.log('success', `World description: "${world.description.substring(0, 50)}..."`);
      }
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Unknown error';
      this.log('warn', `Could not read world info: ${errorMsg}`);
    }
  }

  private readState(world: WldWorld): void {
    try {
      this.log('info', 'Reading world state (WSTA)');
      this.stream.expectChunkID('WSTA');

      const version = this.stream.readInt32();
      this.log('success', `World state version: ${version}`);

      if (this.stream.peekChunkID().toString() === 'WLIF') {
        this.readWorldInfo(world);
      }

      world.backgroundColor = this.stream.readUInt32();
      this.log('success', `Background color: #${world.backgroundColor.toString(16).padStart(6, '0')}`);

    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Unknown error';
      this.log('warn', `Could not fully read world state: ${errorMsg}`);
    }
  }
}

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
  mips: WldBrushMip[];
}

export interface WldBrushMip {
  maxDistance: number;
  sectors: WldSector[];
}

export interface WldSector {
  name: string;
  color: number;
  ambient: number;
  flags: number;
  vertices: Vector3[];
  polygons: WldPolygon[];
}

export interface WldPolygon {
  vertices: Vector3[];
  indices: number[];
  color: number;
  flags: number;
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

      this.skipToWEND();
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
    } else if (nextChunk.toString() === 'BRAR') {
      this.readBrushArchive(world);
    } else {
      this.log('warn', 'No WLIF or BRAR chunk found, skipping');
    }

    let dictionaryPosition = -1;

    const dposChunk = this.stream.peekChunkID();
    if (dposChunk.toString() === 'DPOS') {
      this.log('info', 'Found DPOS (Dictionary Position) chunk');
      this.stream.expectChunkID('DPOS');
      dictionaryPosition = this.stream.readInt32();
      this.log('info', `Dictionary stored at position: ${dictionaryPosition}`);
    }

    this.log('info', 'Searching for WSTA chunk in file...');
    const wstaPosition = this.findChunkInFile('WSTA');

    if (wstaPosition !== -1) {
      this.log('success', `Found WSTA at position: ${wstaPosition}`);
      this.stream.setPosition(wstaPosition);

      if (dictionaryPosition !== -1 && dictionaryPosition < wstaPosition) {
        this.log('info', 'Reading dictionary information...');
        this.readDictionaryInfo(dictionaryPosition);
      }
    } else {
      this.log('error', 'Could not find WSTA chunk');
      throw new Error('WSTA chunk not found in file');
    }
  }

  private readBrushArchive(world: WldWorld): void {
    try {
      this.log('info', 'Reading brush archive (BRAR)');
      this.stream.expectChunkID('BRAR');

      const brushCount = this.stream.readInt32();
      this.log('success', `Found ${brushCount} brushes in archive`);

      for (let i = 0; i < brushCount; i++) {
        this.log('info', `Reading brush ${i + 1}/${brushCount}`);
        const brush = this.readBrush3D();
        if (brush) {
          brush.id = i;
          world.brushes.push(brush);
        }
      }

      const endChunk = this.stream.peekChunkID();
      if (endChunk.toString() === 'PSLS') {
        this.log('info', 'Skipping portal-sector links (PSLS)');
        this.skipPortalSectorLinks();
      }

      if (this.stream.peekChunkID().toString() === 'EOAR') {
        this.stream.expectChunkID('EOAR');
        this.log('success', 'End of brush archive (EOAR)');
      }
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Unknown error';
      this.log('warn', `Could not fully read brush archive: ${errorMsg}`);
    }
  }

  private readBrush3D(): WldBrush | null {
    try {
      this.stream.expectChunkID('BR3D');

      const version = this.stream.readInt32();
      this.log('info', `Brush version: ${version}`);

      const mipCount = this.stream.readInt32();
      this.log('info', `Brush has ${mipCount} mip levels`);

      const brush: WldBrush = {
        id: 0,
        mips: []
      };

      for (let i = 0; i < mipCount; i++) {
        const mip = this.readBrushMip();
        if (mip) {
          brush.mips.push(mip);
        }
      }

      this.stream.expectChunkID('BREN');
      this.log('success', 'Brush read successfully');

      return brush;
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Unknown error';
      this.log('warn', `Could not read brush: ${errorMsg}`);
      return null;
    }
  }

  private readBrushMip(): WldBrushMip | null {
    try {
      let maxDistance = 1000000.0;

      if (this.stream.peekChunkID().toString() === 'BRMP') {
        this.stream.expectChunkID('BRMP');
        maxDistance = this.stream.readFloat32();
      }

      const sectorCount = this.stream.readInt32();
      this.log('info', `Mip has ${sectorCount} sectors`);

      const mip: WldBrushMip = {
        maxDistance,
        sectors: []
      };

      for (let i = 0; i < sectorCount; i++) {
        const sector = this.readBrushSector();
        if (sector) {
          mip.sectors.push(sector);
        }
      }

      return mip;
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Unknown error';
      this.log('warn', `Could not read brush mip: ${errorMsg}`);
      return null;
    }
  }

  private readBrushSector(): WldSector | null {
    try {
      this.stream.expectChunkID('BSC ');

      const version = this.stream.readInt32();

      let name = '';
      if (version >= 1) {
        const nameLength = this.stream.readInt32();
        if (nameLength > 0 && nameLength < 1000) {
          name = this.stream.readString(nameLength);
        }
      }

      const color = this.stream.readUInt32();
      const ambient = this.stream.readUInt32();
      const flags = this.stream.readUInt32();

      if (version >= 2) {
        this.stream.readUInt32(); // flags2
      }
      if (version >= 3) {
        this.stream.readUInt32(); // visFlags
      }

      this.stream.expectChunkID('VTXs');
      const vertexCount = this.stream.readInt32();
      this.log('info', `Sector has ${vertexCount} vertices`);

      const vertices: Vector3[] = [];
      for (let i = 0; i < vertexCount; i++) {
        const x = this.stream.readFloat64();
        const y = this.stream.readFloat64();
        const z = this.stream.readFloat64();
        vertices.push({ x, y, z });
      }

      this.stream.expectChunkID('PLNs');
      const planeCount = this.stream.readInt32();
      this.log('info', `Sector has ${planeCount} planes`);

      for (let i = 0; i < planeCount; i++) {
        this.stream.readFloat64(); // plane normal x
        this.stream.readFloat64(); // plane normal y
        this.stream.readFloat64(); // plane normal z
        this.stream.readFloat64(); // plane distance
      }

      this.stream.expectChunkID('EDGs');
      const edgeCount = this.stream.readInt32();
      for (let i = 0; i < edgeCount; i++) {
        this.stream.readInt32(); // vertex0 index
        this.stream.readInt32(); // vertex1 index
      }

      this.stream.expectChunkID('BPOs');
      const bpoVersion = this.stream.readInt32();
      const polygonCount = this.stream.readInt32();
      this.log('info', `Sector has ${polygonCount} polygons`);

      const polygons: WldPolygon[] = [];
      for (let i = 0; i < polygonCount; i++) {
        const polygon = this.readBrushPolygon(bpoVersion, vertices);
        if (polygon) {
          polygons.push(polygon);
        }
      }

      if (this.stream.peekChunkID().toString() === 'BSP0') {
        this.stream.expectChunkID('BSP0');
        this.skipBSPTree();
      }

      const sector: WldSector = {
        name,
        color,
        ambient,
        flags,
        vertices,
        polygons
      };

      this.log('success', `Sector read: ${polygons.length} polygons, ${vertices.length} vertices`);
      return sector;
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Unknown error';
      this.log('warn', `Could not read sector: ${errorMsg}`);
      return null;
    }
  }

  private readBrushPolygon(version: number, vertices: Vector3[]): WldPolygon | null {
    try {
      this.stream.readInt32(); // plane index

      let color = 0xFFFFFFFF;
      let flags = 0;

      if (version >= 2) {
        color = this.stream.readUInt32();
        flags = this.stream.readUInt32();

        for (let i = 0; i < 3; i++) {
          this.skipTexture();
        }

        this.stream.seek(8, 'current'); // properties
      }

      const edgeCount = this.stream.readInt32();
      for (let i = 0; i < edgeCount; i++) {
        this.stream.readInt32(); // edge index
      }

      let triangleVertices: number[] = [];
      let triangleElements: number[] = [];

      if (version >= 4) {
        const vtxCount = this.stream.readInt32();
        for (let i = 0; i < vtxCount; i++) {
          triangleVertices.push(this.stream.readInt32());
        }

        const elemCount = this.stream.readInt32();
        for (let i = 0; i < elemCount; i++) {
          triangleElements.push(this.stream.readInt32());
        }
      }

      this.skipShadowMap();

      if (version >= 2) {
        this.stream.readUInt32(); // shadow color
      } else {
        this.stream.readUInt8(); // dummy
      }

      const polygonVertices: Vector3[] = [];
      for (const idx of triangleVertices) {
        if (idx >= 0 && idx < vertices.length) {
          polygonVertices.push(vertices[idx]);
        }
      }

      const polygon: WldPolygon = {
        vertices: polygonVertices,
        indices: triangleElements,
        color,
        flags
      };

      return polygon;
    } catch (error) {
      return null;
    }
  }

  private skipTexture(): void {
    const filenameLength = this.stream.readInt32();
    if (filenameLength > 0 && filenameLength < 500) {
      this.stream.seek(filenameLength, 'current');
    }
    this.stream.seek(64, 'current'); // mapping definition
    this.stream.seek(8, 'current'); // texture properties
  }

  private skipShadowMap(): void {
    try {
      const smID = this.stream.peekChunkID();
      if (smID.toString() === 'SHMP') {
        this.stream.expectChunkID('SHMP');
        const size = this.stream.readInt32();
        if (size > 0 && size < 10000000) {
          this.stream.seek(size, 'current');
        }
      }
    } catch (error) {
      // Shadow map is optional
    }
  }

  private skipBSPTree(): void {
    try {
      const nodeCount = this.stream.readInt32();
      if (nodeCount > 0 && nodeCount < 1000000) {
        this.stream.seek(nodeCount * 48, 'current'); // Skip BSP nodes
      }
    } catch (error) {
      this.log('warn', 'Could not skip BSP tree');
    }
  }

  private skipPortalSectorLinks(): void {
    try {
      this.stream.expectChunkID('PSLS');
      this.stream.readInt32(); // version
      const chunkSize = this.stream.readInt32();

      if (chunkSize > 0 && chunkSize < 100000000) {
        this.stream.seek(chunkSize, 'current');
      }

      this.stream.expectChunkID('PSLE');
    } catch (error) {
      this.log('warn', 'Could not skip portal-sector links');
    }
  }

  private findChunkInFile(chunkID: string): number {
    const fileSize = this.stream.getSize();
    const startPos = this.stream.getPosition();

    for (let i = startPos; i < fileSize - 4; i++) {
      this.stream.setPosition(i);
      const chunk = this.stream.peekChunkID().toString();

      if (chunk === chunkID) {
        return i;
      }
    }

    this.stream.setPosition(startPos);
    return -1;
  }

  private readDictionaryInfo(position: number): void {
    try {
      const savedPosition = this.stream.getPosition();

      this.stream.setPosition(position);
      this.stream.expectChunkID('DICT');

      const fileNameCount = this.stream.readInt32();
      this.log('success', `Dictionary contains ${fileNameCount} textures/resources`);

      for (let i = 0; i < Math.min(fileNameCount, 3); i++) {
        const fnLength = this.stream.readInt32();
        if (fnLength > 0 && fnLength < 500) {
          const filename = this.stream.readString(fnLength);
          this.log('info', `  [${i + 1}] ${filename}`);
        }
      }

      if (fileNameCount > 3) {
        this.log('info', `  ... and ${fileNameCount - 3} more resources`);
      }

      this.stream.setPosition(savedPosition);
    } catch (error) {
      this.log('warn', 'Could not read dictionary details');
      this.stream.setPosition(this.stream.getPosition());
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

  private skipToWEND(): void {
    this.log('info', 'Searching for WEND chunk in remaining data...');

    const wendBytes = new TextEncoder().encode('WEND');

    while (!this.stream.atEOF()) {
      const currentPos = this.stream.getPosition();

      if (this.stream.getSize() - currentPos < 4) {
        break;
      }

      const bytes = new Uint8Array(4);
      for (let i = 0; i < 4; i++) {
        bytes[i] = this.stream.readUInt8();
      }

      if (bytes[0] === wendBytes[0] &&
          bytes[1] === wendBytes[1] &&
          bytes[2] === wendBytes[2] &&
          bytes[3] === wendBytes[3]) {
        this.stream.seek(-4, 'current');
        this.log('success', `Found WEND at position ${this.stream.getPosition()}`);
        return;
      }

      this.stream.seek(-3, 'current');
    }

    this.log('warn', 'WEND chunk not found, file may be incomplete');
  }
}

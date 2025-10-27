
/**
 * KeyGeometry
 * 
 * Extracted from lockpicking-game-phaser.js
 * Instantiate with: new KeyGeometry(this)
 * 
 * All 'this' references replaced with 'this.parent' to access parent instance state:
 * - this.parent.pins (array of pin objects)
 * - this.parent.scene (Phaser scene)
 * - this.parent.lockId (lock identifier)
 * - this.parent.lockState (lock state object)
 * etc.
 */
export class KeyGeometry {
    
    constructor(parent) {
        this.parent = parent;
    }

    getKeySurfaceHeightAtPinPosition(pinX, keyBladeStartX, keyBladeBaseY) {
        // Use collision detection to find the key surface height at a specific pin position
        // This method traces a vertical line from the pin position down to find where it intersects the key polygon
        
        const bladeWidth = this.parent.keyConfig.bladeWidth;
        const bladeHeight = this.parent.keyConfig.bladeHeight;
        
        // Calculate the pin's position relative to the key blade
        const pinRelativeToKey = pinX - keyBladeStartX;
        
        // If pin is beyond the key blade, return base surface
        if (pinRelativeToKey < 0 || pinRelativeToKey > bladeWidth) {
            return keyBladeBaseY;
        }
        
        // Generate the key polygon points at the current position
        const keyPolygonPoints = this.generateKeyPolygonPoints(keyBladeStartX, keyBladeBaseY);
        
        // Find the intersection point by tracing a vertical line from the pin position
        const intersectionY = this.findVerticalIntersection(pinX, keyBladeBaseY, keyBladeBaseY + bladeHeight, keyPolygonPoints);
        
        return intersectionY !== null ? intersectionY : keyBladeBaseY;
    }

    generateKeyPolygonPoints(keyBladeStartX, keyBladeBaseY) {
        // Generate the key polygon points at the current position
        // This recreates the same polygon logic used in drawKeyBladeAsSolidShape
        const points = [];
        const bladeWidth = this.parent.keyConfig.bladeWidth;
        const bladeHeight = this.parent.keyConfig.bladeHeight;
        const cutWidth = 24;
        
        // Calculate pin spacing
        const pinSpacing = 400 / (this.parent.pinCount + 1);
        const margin = pinSpacing * 0.75;
        
        // Start at the top-left corner of the blade
        points.push({ x: keyBladeStartX, y: keyBladeBaseY });
        
        let currentX = keyBladeStartX;
        
        // Generate the same path as the drawing method
        for (let i = 0; i <= this.parent.pinCount; i++) {
            let cutDepth = 0;
            let nextCutDepth = 0;
            
            if (i < this.parent.pinCount) {
                cutDepth = (this.parent.selectedKeyData || this.parent.keyData).cuts[i] || 0;
            }
            if (i < this.parent.pinCount - 1) {
                nextCutDepth = (this.parent.selectedKeyData || this.parent.keyData).cuts[i + 1] || 0;
            }
            
            // Calculate pin position
            const pinX = 100 + margin + i * pinSpacing;
            const cutX = keyBladeStartX + (pinX - 100);
            
            if (i === 0) {
                // First section: from left edge to first cut
                const firstCutStartX = cutX - cutWidth/2;
                this.parent.keyPointGeom.addTriangularPeakToPoints(points, currentX, keyBladeBaseY, firstCutStartX, keyBladeBaseY, 0, cutDepth);
                currentX = firstCutStartX;
            }
            
            if (i < this.parent.pinCount) {
                // Draw the cut
            const cutStartX = cutX - cutWidth/2;
            const cutEndX = cutX + cutWidth/2;
                points.push({ x: cutStartX, y: keyBladeBaseY + cutDepth });
                points.push({ x: cutEndX, y: keyBladeBaseY + cutDepth });
                currentX = cutEndX;
            }
            
            if (i < this.parent.pinCount - 1) {
                // Draw triangular peak to next cut
                const nextPinX = 100 + margin + (i + 1) * pinSpacing;
                const nextCutX = keyBladeStartX + (nextPinX - 100);
                const nextCutStartX = nextCutX - cutWidth/2;
                this.parent.keyPointGeom.addTriangularPeakToPoints(points, currentX, keyBladeBaseY, nextCutStartX, keyBladeBaseY, cutDepth, nextCutDepth);
                currentX = nextCutStartX;
            } else if (i === this.parent.pinCount - 1) {
                // Last section: pointed tip
                const keyRightEdge = keyBladeStartX + bladeWidth;
                const tipExtension = 12;
                const tipEndX = keyRightEdge + tipExtension;
                const peakX = currentX + (keyRightEdge - currentX) * 0.3;
                this.parent.keyPointGeom.addTriangularPeakToPoints(points, currentX, keyBladeBaseY, peakX, keyBladeBaseY, cutDepth, 0);
                this.parent.keyPointGeom.addPointedTipToPoints(points, peakX, keyBladeBaseY, tipEndX, bladeHeight);
                currentX = tipEndX;
            }
        }
        
        // Complete the path
        points.push({ x: keyBladeStartX + bladeWidth, y: keyBladeBaseY + bladeHeight });
        points.push({ x: keyBladeStartX, y: keyBladeBaseY + bladeHeight });
        points.push({ x: keyBladeStartX, y: keyBladeBaseY });
        
        return points;
    }

    findVerticalIntersection(pinX, startY, endY, polygonPoints) {
        // Find where a vertical line at pinX intersects the polygon
        // Returns the Y coordinate of the intersection, or null if no intersection
        
        let intersectionY = null;
        
        for (let i = 0; i < polygonPoints.length - 1; i++) {
            const p1 = polygonPoints[i];
            const p2 = polygonPoints[i + 1];
            
            // Check if this line segment crosses the vertical line at pinX
            if ((p1.x <= pinX && p2.x >= pinX) || (p1.x >= pinX && p2.x <= pinX)) {
                // Calculate intersection
                const t = (pinX - p1.x) / (p2.x - p1.x);
                const y = p1.y + t * (p2.y - p1.y);
                
                // Keep the highest intersection point (closest to the pin)
                if (intersectionY === null || y < intersectionY) {
                    intersectionY = y;
                }
            }
        }
        
        return intersectionY;
    }

    getKeySurfaceHeightAtPosition(pinX, keyBladeStartX) {
        // Method moved to KeyOperations module - delegate to it
        return this.parent.keyOps.getKeySurfaceHeightAtPosition(pinX, keyBladeStartX);
    }
    
}

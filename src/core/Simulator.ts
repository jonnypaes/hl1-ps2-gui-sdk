// /src/core/Simulator.ts

import { GuiCommand } from './Types';

//Interface for final render commands sent to the Webview.
export class Simulator {
    private elements: GuiCommand[] = [];
    private variables = new Map<string, number>();

    constructor(elements: GuiCommand[]) {
        this.elements = elements;
    }

    // Defines state variables (e.g., "looper", "is_paused") to simulate menu logic.
    public setVariable(name: string, value: number) {
        this.variables.set(name, value);
    }

    // Processes the list of GUI elements and returns only what should be visible. 
    // Implements DEPENDS_VALUE logic and Z-Plane ordering (Painter's Algorithm).
    public simulate(): GuiCommand[] {
        // Get the current value of "looper" (default 0 if not defined)
        const val = this.variables.get('looper') ?? 0;

        return this.elements
            .filter(e => {
                // If there is no dependency, the element is visible by default
                if (!e.dependsOn) return true;

                // Try to convert dependsOn (resolved macro) to a number
                const threshold = parseInt(e.dependsOn);
                
                // The element only appears if the variable value is >= threshold
                return !isNaN(threshold) ? val >= threshold : true;
            })
            // Ensures correct drawing order (lower Z in back, higher Z in front)
            .sort((a, b) => a.zPlane - b.zPlane);
    }
}

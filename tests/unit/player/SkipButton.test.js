/**
 * SkipButton Unit Tests
 */

import { SkipButton } from '../../../app/js/player/SkipButton.js';

describe('SkipButton', () => {
    let container;
    let skipCallback;

    beforeEach(() => {
        // Create a mock container
        container = document.createElement('div');
        document.body.appendChild(container);

        // Create a callback spy
        skipCallback = jest.fn();
    });

    afterEach(() => {
        if (container && container.parentNode) {
            container.parentNode.removeChild(container);
        }
    });

    describe('constructor', () => {
        it('should create a skip button instance', () => {
            const skipBtn = new SkipButton({
                container,
                onSkip: skipCallback,
            });

            expect(skipBtn).toBeDefined();
            expect(skipBtn.buttonElement).toBeDefined();
            expect(skipBtn.markers).toBeNull();
            expect(skipBtn.isVisible).toBe(false);
        });

        it('should create button element with correct class', () => {
            const skipBtn = new SkipButton({
                container,
                onSkip: skipCallback,
            });

            expect(skipBtn.buttonElement.className).toBe('skip-btn');
            expect(skipBtn.buttonElement.id).toBe('skipBtn');
        });

        it('should default onSkip to empty function', () => {
            const skipBtn = new SkipButton({ container });
            expect(skipBtn.onSkip).toBeDefined();
        });
    });

    describe('setMarkers', () => {
        it('should set skip markers', () => {
            const skipBtn = new SkipButton({ container });
            const markers = {
                skip_intro_start: 10,
                skip_intro_end: 90,
                skip_outro_start: 2340,
                skip_outro_end: 2520,
            };

            skipBtn.setMarkers(markers);
            expect(skipBtn.markers).toEqual(markers);
        });

        it('should handle null markers', () => {
            const skipBtn = new SkipButton({ container });
            skipBtn.setMarkers(null);
            expect(skipBtn.markers).toBeNull();
        });
    });

    describe('updatePosition', () => {
        it('should show skip intro button when within intro range', () => {
            const skipBtn = new SkipButton({ container, onSkip: skipCallback });
            skipBtn.setMarkers({
                skip_intro_start: 10,
                skip_intro_end: 90,
                skip_outro_start: 2340,
                skip_outro_end: 2520,
            });

            skipBtn.updatePosition(50); // Within intro range (10-90)

            expect(skipBtn.isButtonVisible()).toBe(true);
            expect(skipBtn.getCurrentButtonType()).toBe('intro');
            expect(skipBtn.buttonElement.textContent).toBe('Skip Intro');
        });

        it('should show skip outro button when within outro range', () => {
            const skipBtn = new SkipButton({ container, onSkip: skipCallback });
            skipBtn.setMarkers({
                skip_intro_start: 10,
                skip_intro_end: 90,
                skip_outro_start: 2340,
                skip_outro_end: 2520,
            });

            skipBtn.updatePosition(2400); // Within outro range (2340-2520)

            expect(skipBtn.isButtonVisible()).toBe(true);
            expect(skipBtn.getCurrentButtonType()).toBe('outro');
            expect(skipBtn.buttonElement.textContent).toBe('Skip Outro');
        });

        it('should hide button when outside marker ranges', () => {
            const skipBtn = new SkipButton({ container, onSkip: skipCallback });
            skipBtn.setMarkers({
                skip_intro_start: 10,
                skip_intro_end: 90,
                skip_outro_start: 2340,
                skip_outro_end: 2520,
            });

            skipBtn.updatePosition(500); // Outside both ranges

            expect(skipBtn.isButtonVisible()).toBe(false);
            expect(skipBtn.getCurrentButtonType()).toBeNull();
        });

        it('should hide button when markers are null', () => {
            const skipBtn = new SkipButton({ container, onSkip: skipCallback });
            skipBtn.setMarkers(null);

            skipBtn.updatePosition(50);

            expect(skipBtn.isButtonVisible()).toBe(false);
        });

        it('should handle intro start exactly at boundary', () => {
            const skipBtn = new SkipButton({ container, onSkip: skipCallback });
            skipBtn.setMarkers({
                skip_intro_start: 10,
                skip_intro_end: 90,
                skip_outro_start: 2340,
                skip_outro_end: 2520,
            });

            skipBtn.updatePosition(10); // Exactly at intro start

            expect(skipBtn.isButtonVisible()).toBe(true);
            expect(skipBtn.getCurrentButtonType()).toBe('intro');
        });

        it('should handle intro end exactly at boundary', () => {
            const skipBtn = new SkipButton({ container, onSkip: skipCallback });
            skipBtn.setMarkers({
                skip_intro_start: 10,
                skip_intro_end: 90,
                skip_outro_start: 2340,
                skip_outro_end: 2520,
            });

            skipBtn.updatePosition(90); // Exactly at intro end

            expect(skipBtn.isButtonVisible()).toBe(true);
            expect(skipBtn.getCurrentButtonType()).toBe('intro');
        });

        it('should prioritize intro when overlapping ranges', () => {
            const skipBtn = new SkipButton({ container, onSkip: skipCallback });
            skipBtn.setMarkers({
                skip_intro_start: 10,
                skip_intro_end: 2400,
                skip_outro_start: 2340,
                skip_outro_end: 2520,
            });

            skipBtn.updatePosition(2350); // Within both intro (10-2400) and outro (2340-2520)

            expect(skipBtn.isButtonVisible()).toBe(true);
            expect(skipBtn.getCurrentButtonType()).toBe('intro');
        });
    });

    describe('shouldShowIntro', () => {
        it('should return true when within intro range', () => {
            const skipBtn = new SkipButton({ container });
            skipBtn.setMarkers({
                skip_intro_start: 10,
                skip_intro_end: 90,
            });

            expect(skipBtn.shouldShowIntro(50)).toBe(true);
        });

        it('should return false when outside intro range', () => {
            const skipBtn = new SkipButton({ container });
            skipBtn.setMarkers({
                skip_intro_start: 10,
                skip_intro_end: 90,
            });

            expect(skipBtn.shouldShowIntro(100)).toBe(false);
        });

        it('should return false when markers are null', () => {
            const skipBtn = new SkipButton({ container });
            skipBtn.setMarkers(null);

            expect(skipBtn.shouldShowIntro(50)).toBe(false);
        });

        it('should return false when skip_intro_start is null', () => {
            const skipBtn = new SkipButton({ container });
            skipBtn.setMarkers({
                skip_intro_start: null,
                skip_intro_end: 90,
            });

            expect(skipBtn.shouldShowIntro(50)).toBe(false);
        });
    });

    describe('shouldShowOutro', () => {
        it('should return true when within outro range', () => {
            const skipBtn = new SkipButton({ container });
            skipBtn.setMarkers({
                skip_outro_start: 2340,
                skip_outro_end: 2520,
            });

            expect(skipBtn.shouldShowOutro(2400)).toBe(true);
        });

        it('should return false when outside outro range', () => {
            const skipBtn = new SkipButton({ container });
            skipBtn.setMarkers({
                skip_outro_start: 2340,
                skip_outro_end: 2520,
            });

            expect(skipBtn.shouldShowOutro(2300)).toBe(false);
        });

        it('should return false when markers are null', () => {
            const skipBtn = new SkipButton({ container });
            skipBtn.setMarkers(null);

            expect(skipBtn.shouldShowOutro(2400)).toBe(false);
        });

        it('should return false when skip_outro_start is null', () => {
            const skipBtn = new SkipButton({ container });
            skipBtn.setMarkers({
                skip_outro_start: null,
                skip_outro_end: 2520,
            });

            expect(skipBtn.shouldShowOutro(2400)).toBe(false);
        });
    });

    describe('handleClick', () => {
        it('should call onSkip with correct position', () => {
            const skipBtn = new SkipButton({ container, onSkip: skipCallback });
            skipBtn.setMarkers({
                skip_intro_start: 10,
                skip_intro_end: 90,
            });
            skipBtn.showButton('intro', 90);

            skipBtn.handleClick();

            expect(skipCallback).toHaveBeenCalledWith(90);
        });

        it('should hide button after clicking', () => {
            const skipBtn = new SkipButton({ container, onSkip: skipCallback });
            skipBtn.setMarkers({
                skip_intro_start: 10,
                skip_intro_end: 90,
            });
            skipBtn.showButton('intro', 90);

            skipBtn.handleClick();

            expect(skipBtn.isButtonVisible()).toBe(false);
        });

        it('should not crash when currentButton is null', () => {
            const skipBtn = new SkipButton({ container, onSkip: skipCallback });
            skipBtn.currentButton = null;

            expect(() => skipBtn.handleClick()).not.toThrow();
            expect(skipCallback).not.toHaveBeenCalled();
        });
    });

    describe('showButton', () => {
        it('should show button with intro text', () => {
            const skipBtn = new SkipButton({ container, onSkip: skipCallback });

            skipBtn.showButton('intro', 90);

            expect(skipBtn.isButtonVisible()).toBe(true);
            expect(skipBtn.getCurrentButtonType()).toBe('intro');
            expect(skipBtn.buttonElement.textContent).toBe('Skip Intro');
            expect(skipBtn.buttonElement.style.display).toBe('block');
        });

        it('should show button with outro text', () => {
            const skipBtn = new SkipButton({ container, onSkip: skipCallback });

            skipBtn.showButton('outro', 2520);

            expect(skipBtn.isButtonVisible()).toBe(true);
            expect(skipBtn.getCurrentButtonType()).toBe('outro');
            expect(skipBtn.buttonElement.textContent).toBe('Skip Outro');
        });

        it('should update skipTo position when type changes', () => {
            const skipBtn = new SkipButton({ container, onSkip: skipCallback });

            skipBtn.showButton('intro', 90);
            skipBtn.showButton('outro', 2520);

            expect(skipBtn.buttonElement.dataset.skipTo).toBe('2520');
        });
    });

    describe('hideButton', () => {
        it('should hide the button', () => {
            const skipBtn = new SkipButton({ container, onSkip: skipCallback });
            skipBtn.showButton('intro', 90);

            skipBtn.hideButton();

            expect(skipBtn.isButtonVisible()).toBe(false);
            expect(skipBtn.getCurrentButtonType()).toBeNull();
            expect(skipBtn.buttonElement.style.display).toBe('none');
        });
    });

    describe('destroy', () => {
        it('should remove button from DOM', () => {
            const skipBtn = new SkipButton({ container, onSkip: skipCallback });
            const buttonInDom = document.getElementById('skipBtn');

            skipBtn.destroy();

            expect(document.getElementById('skipBtn')).toBeNull();
        });

        it('should reset all properties', () => {
            const skipBtn = new SkipButton({ container, onSkip: skipCallback });
            skipBtn.setMarkers({
                skip_intro_start: 10,
                skip_intro_end: 90,
            });
            skipBtn.showButton('intro', 90);

            skipBtn.destroy();

            expect(skipBtn.buttonElement).toBeNull();
            expect(skipBtn.markers).toBeNull();
            expect(skipBtn.isVisible).toBe(false);
            expect(skipBtn.currentButton).toBeNull();
        });
    });

    describe('null marker handling', () => {
        it('should not show intro button when skip_intro_start is null', () => {
            const skipBtn = new SkipButton({ container, onSkip: skipCallback });
            skipBtn.setMarkers({
                skip_intro_start: null,
                skip_intro_end: 90,
                skip_outro_start: 2340,
                skip_outro_end: 2520,
            });

            skipBtn.updatePosition(50);

            expect(skipBtn.isButtonVisible()).toBe(false);
        });

        it('should not show outro button when skip_outro_start is null', () => {
            const skipBtn = new SkipButton({ container, onSkip: skipCallback });
            skipBtn.setMarkers({
                skip_intro_start: 10,
                skip_intro_end: 90,
                skip_outro_start: null,
                skip_outro_end: 2520,
            });

            skipBtn.updatePosition(2400);

            expect(skipBtn.isButtonVisible()).toBe(false);
        });

        it('should handle all null markers gracefully', () => {
            const skipBtn = new SkipButton({ container, onSkip: skipCallback });
            skipBtn.setMarkers({
                skip_intro_start: null,
                skip_intro_end: null,
                skip_outro_start: null,
                skip_outro_end: null,
            });

            skipBtn.updatePosition(50);
            expect(skipBtn.isButtonVisible()).toBe(false);

            skipBtn.updatePosition(2400);
            expect(skipBtn.isButtonVisible()).toBe(false);
        });
    });
});

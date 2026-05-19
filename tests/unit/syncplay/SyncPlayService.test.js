/**
 * SyncPlayService Unit Tests
 */

import { SyncPlayService, MessageTypes, PlaybackState } from '../../../app/js/syncplay/SyncPlayService.js';

describe('SyncPlayService', () => {
    let syncPlayService;

    beforeEach(() => {
        syncPlayService = new SyncPlayService();
    });

    afterEach(() => {
        syncPlayService.disconnect();
    });

    describe('Constructor', () => {
        it('should create instance with correct defaults', () => {
            expect(syncPlayService.isConnected).toBe(false);
            expect(syncPlayService.isInGroup).toBe(false);
            expect(syncPlayService.groupId).toBeNull();
            expect(syncPlayService.memberId).toBeNull();
            expect(syncPlayService.hostId).toBeNull();
            expect(syncPlayService.members).toEqual([]);
            expect(syncPlayService.offsetSamples).toEqual([]);
        });
    });

    describe('init', () => {
        it('should set base URL and WebSocket URL', () => {
            syncPlayService.init('http://localhost:8096');
            expect(syncPlayService.baseUrl).toBe('http://localhost:8096');
            expect(syncPlayService.wsUrl).toBe('ws://localhost:8096/ws/syncplay');
        });

        it('should handle URLs with trailing slash', () => {
            syncPlayService.init('http://localhost:8096/');
            expect(syncPlayService.baseUrl).toBe('http://localhost:8096');
        });
    });

    describe('TimeSync', () => {
        beforeEach(() => {
            syncPlayService.init('http://localhost:8096');
        });

        it('should start with zero offset', () => {
            expect(syncPlayService.getTimeOffset()).toBe(0);
        });

        it('should add offset samples', () => {
            syncPlayService.addOffsetSample(100, 50);
            syncPlayService.addOffsetSample(200, 60);
            expect(syncPlayService.offsetSamples).toHaveLength(2);
        });

        it('should keep only recent samples', () => {
            // Add more than 10 samples (OFFSET_SAMPLE_COUNT * 2)
            for (let i = 0; i < 15; i++) {
                syncPlayService.addOffsetSample(i * 10, 50);
            }
            expect(syncPlayService.offsetSamples.length).toBeLessThanOrEqual(10);
        });

        it('should calculate weighted average offset', () => {
            syncPlayService.addOffsetSample(100, 50);  // RTT 50ms
            syncPlayService.addOffsetSample(200, 100); // RTT 100ms

            const offset = syncPlayService.getTimeOffset();
            // Lower RTT sample should have higher weight
            expect(offset).toBeGreaterThan(100);
            expect(offset).toBeLessThan(200);
        });

        it('should calculate estimated latency', () => {
            syncPlayService.addOffsetSample(100, 50);
            syncPlayService.addOffsetSample(100, 100);

            const latency = syncPlayService.getEstimatedLatency();
            expect(latency).toBe(37.5); // Average of 25 and 50
        });

        it('should detect sync stability', () => {
            expect(syncPlayService.isSyncStable()).toBe(false);

            // Add enough samples with similar offsets
            for (let i = 0; i < 5; i++) {
                syncPlayService.addOffsetSample(100, 50);
            }

            expect(syncPlayService.isSyncStable()).toBe(true);
        });

        it('should reject samples with high RTT', () => {
            const initialLength = syncPlayService.offsetSamples.length;
            syncPlayService.addOffsetSample(100, 2000); // RTT > MAX_ACCEPTABLE_RTT
            expect(syncPlayService.offsetSamples).toHaveLength(initialLength);
        });

        it('should reset time sync state', () => {
            syncPlayService.addOffsetSample(100, 50);
            syncPlayService.driftRate = 1.5;
            syncPlayService.lastTimeSync = Date.now();

            syncPlayService.resetTimeSync();

            expect(syncPlayService.offsetSamples).toEqual([]);
            expect(syncPlayService.driftRate).toBe(1.0);
            expect(syncPlayService.lastTimeSync).toBe(0);
        });

        it('should get time sync status', () => {
            syncPlayService.addOffsetSample(100, 50);
            syncPlayService.driftRate = 1.1;
            syncPlayService.lastTimeSync = Date.now();

            const status = syncPlayService.getTimeSyncStatus();

            expect(status).toHaveProperty('offset');
            expect(status).toHaveProperty('latency');
            expect(status).toHaveProperty('driftRate', 1.1);
            expect(status).toHaveProperty('isStable');
            expect(status).toHaveProperty('sampleCount', 1);
            expect(status).toHaveProperty('lastSync');
        });

        it('should get synchronized time', () => {
            syncPlayService.addOffsetSample(100, 50);

            const syncTime = syncPlayService.getSynchronizedTime();
            const now = Date.now();

            expect(syncTime).toBeGreaterThanOrEqual(now + 100);
            expect(syncTime).toBeLessThanOrEqual(now + 200);
        });

        it('should calculate adjusted position with drift', () => {
            syncPlayService.addOffsetSample(100, 50);
            syncPlayService.driftRate = 1.05;

            const adjusted = syncPlayService.calculateAdjustedPosition(1000, Date.now() - 5000);

            expect(adjusted).toBeGreaterThan(1000); // Should be increased due to drift
        });
    });

    describe('Event System', () => {
        it('should register and emit events', () => {
            let called = false;
            syncPlayService.on('testEvent', () => {
                called = true;
            });

            syncPlayService.emit('testEvent', { data: 'test' });

            expect(called).toBe(true);
        });

        it('should pass data to event handlers', () => {
            let receivedData = null;
            syncPlayService.on('testEvent', (data) => {
                receivedData = data;
            });

            syncPlayService.emit('testEvent', { key: 'value' });

            expect(receivedData).toEqual({ key: 'value' });
        });

        it('should remove event listeners', () => {
            let callCount = 0;
            const handler = () => callCount++;

            syncPlayService.on('testEvent', handler);
            syncPlayService.emit('testEvent');
            syncPlayService.off('testEvent', handler);
            syncPlayService.emit('testEvent');

            expect(callCount).toBe(1);
        });
    });

    describe('Message Handling', () => {
        beforeEach(() => {
            syncPlayService.init('http://localhost:8096');
        });

        it('should handle group state message', () => {
            const stateData = {
                group_id: 'test-group-123',
                members: [
                    { id: 'member-1', name: 'User 1', is_host: true },
                    { id: 'member-2', name: 'User 2', is_host: false },
                ],
                host_id: 'member-1',
                current_media_id: 'media-123',
                playback_state: 'playing',
                playback_position: 5000,
            };

            let receivedData = null;
            syncPlayService.on('groupState', (data) => {
                receivedData = data;
            });

            // Simulate message handling
            syncPlayService.handleGroupState(stateData);

            expect(syncPlayService.groupId).toBe('test-group-123');
            expect(syncPlayService.members).toHaveLength(2);
            expect(syncPlayService.hostId).toBe('member-1');
            expect(syncPlayService.currentMediaId).toBe('media-123');
            expect(syncPlayService.playbackState).toBe('playing');
            expect(syncPlayService.currentPosition).toBe(5000);
            expect(receivedData).toEqual(stateData);
        });

        it('should handle member joined message', () => {
            const memberData = {
                member_id: 'member-3',
                member_name: 'User 3',
                is_host: false,
            };

            let receivedMember = null;
            syncPlayService.on('memberJoined', (member) => {
                receivedMember = member;
            });

            syncPlayService.handleMemberJoined(memberData);

            expect(syncPlayService.members).toHaveLength(1);
            expect(syncPlayService.members[0].id).toBe('member-3');
            expect(receivedMember.id).toBe('member-3');
        });

        it('should handle member left message', () => {
            // First add a member
            syncPlayService.members = [
                { id: 'member-1', name: 'User 1' },
                { id: 'member-2', name: 'User 2' },
            ];
            syncPlayService.hostId = 'member-1';

            let receivedMember = null;
            syncPlayService.on('memberLeft', (member) => {
                receivedMember = member;
            });

            syncPlayService.handleMemberLeft({ member_id: 'member-1' });

            expect(syncPlayService.members).toHaveLength(1);
            expect(syncPlayService.members[0].id).toBe('member-2');
            expect(syncPlayService.hostId).toBeNull(); // Host left
            expect(receivedMember.id).toBe('member-1');
        });

        it('should handle time pong message', () => {
            const now = Date.now();
            const clientSendTime = now - 100;

            syncPlayService._lastPingTime = clientSendTime;

            let receivedData = null;
            syncPlayService.on('timeSync', (data) => {
                receivedData = data;
            });

            syncPlayService.handleTimePong({
                client_time: clientSendTime,
                server_time: now - 50,
                server_receive_time: now - 60,
            });

            expect(syncPlayService.offsetSamples.length).toBeGreaterThan(0);
            expect(receivedData).toHaveProperty('offset');
            expect(receivedData).toHaveProperty('latency');
            expect(receivedData).toHaveProperty('rtt');
        });

        it('should handle playback play command', () => {
            syncPlayService.hostId = 'host-1';  // Set host for test

            let commandData = null;
            syncPlayService.on('playbackCommand', (data) => {
                commandData = data;
            });

            syncPlayService.handlePlaybackCommand('play', {
                member_id: 'host-1',
                position: 10000,
                server_time: Date.now(),
            });

            expect(commandData.command).toBe('play');
            expect(commandData.position).toBe(10000);
        });

        it('should handle playback pause command', () => {
            syncPlayService.hostId = 'host-1';  // Set host for test

            let commandData = null;
            syncPlayService.on('playbackCommand', (data) => {
                commandData = data;
            });

            syncPlayService.handlePlaybackCommand('pause', {
                member_id: 'host-1',
                position: 15000,
                server_time: Date.now(),
            });

            expect(commandData.command).toBe('pause');
            expect(commandData.position).toBe(15000);
        });

        it('should handle seek command', () => {
            syncPlayService.hostId = 'host-1';  // Set host for test

            let seekData = null;
            syncPlayService.on('playbackSeek', (data) => {
                seekData = data;
            });

            syncPlayService.handlePlaybackSeek({
                member_id: 'host-1',
                from_position: 10000,
                to_position: 20000,
                server_time: Date.now(),
            });

            expect(seekData.fromPosition).toBe(10000);
            // toPosition is adjusted by calculateAdjustedPosition
            expect(seekData.toPosition).toBeDefined();
        });

        it('should handle playback sync', () => {
            syncPlayService.hostId = 'host-1';  // Set host for test

            let syncData = null;
            syncPlayService.on('playbackSync', (data) => {
                syncData = data;
            });

            syncPlayService.handlePlaybackSync({
                member_id: 'host-1',
                position: 25000,
                is_playing: true,
                server_time: Date.now(),
            });

            expect(syncData.position).toBe(25000);
            expect(syncData.isPlaying).toBe(true);
        });

        it('should handle error message', () => {
            let errorData = null;
            syncPlayService.on('error', (data) => {
                errorData = data;
            });

            syncPlayService.handleError({
                error_code: 'GROUP_FULL',
                message: 'Cannot join: group is full',
            });

            expect(errorData.code).toBe('GROUP_FULL');
            expect(errorData.message).toBe('Cannot join: group is full');
        });

        it('should handle info message', () => {
            let infoData = null;
            syncPlayService.on('info', (data) => {
                infoData = data;
            });

            syncPlayService.handleInfo({
                message: 'Welcome to the group!',
                data: { group_id: 'test' },
            });

            expect(infoData.message).toBe('Welcome to the group!');
            expect(infoData.data.group_id).toBe('test');
        });
    });

    describe('Group Management', () => {
        beforeEach(() => {
            syncPlayService.init('http://localhost:8096');
        });

        it('should update group state correctly', () => {
            syncPlayService.handleGroupState({
                group_id: 'group-123',
                members: [{ id: 'm1', name: 'User 1' }],
                host_id: 'm1',
                playback_state: 'paused',
                playback_position: 0,
            });

            expect(syncPlayService.groupId).toBe('group-123');
            expect(syncPlayService.isInGroup).toBe(true);
            expect(syncPlayService.playbackState).toBe('paused');
        });

        it('should leave group cleanly', () => {
            syncPlayService.groupId = 'test-group';
            syncPlayService.memberId = 'test-member';
            syncPlayService.isInGroup = true;
            syncPlayService.hostId = 'test-member';
            syncPlayService.members = [{ id: 'test-member', name: 'Test' }];

            syncPlayService.leaveGroup();

            expect(syncPlayService.groupId).toBeNull();
            expect(syncPlayService.memberId).toBeNull();
            expect(syncPlayService.isInGroup).toBe(false);
            expect(syncPlayService.members).toEqual([]);
        });
    });

    describe('Password Hashing', () => {
        it('should hash password consistently', () => {
            const hash1 = syncPlayService.hashPassword('test123');
            const hash2 = syncPlayService.hashPassword('test123');

            expect(hash1).toBe(hash2);
        });

        it('should produce different hashes for different passwords', () => {
            const hash1 = syncPlayService.hashPassword('password1');
            const hash2 = syncPlayService.hashPassword('password2');

            expect(hash1).not.toBe(hash2);
        });
    });
});

describe('MessageTypes', () => {
    it('should have correct outgoing message types', () => {
        expect(MessageTypes.GROUP_CREATE).toBe('syncplay_group_create');
        expect(MessageTypes.GROUP_JOIN).toBe('syncplay_group_join');
        expect(MessageTypes.GROUP_LEAVE).toBe('syncplay_group_leave');
        expect(MessageTypes.PLAYBACK_PLAY).toBe('syncplay_playback_play');
        expect(MessageTypes.PLAYBACK_PAUSE).toBe('syncplay_playback_pause');
        expect(MessageTypes.PLAYBACK_SEEK).toBe('syncplay_playback_seek');
        expect(MessageTypes.TIME_PING).toBe('syncplay_time_ping');
    });

    it('should have correct incoming message types', () => {
        expect(MessageTypes.GROUP_STATE).toBe('syncplay_group_state');
        expect(MessageTypes.PLAYBACK_SYNC).toBe('syncplay_playback_sync');
        expect(MessageTypes.MEMBER_JOINED).toBe('syncplay_member_joined');
        expect(MessageTypes.MEMBER_LEFT).toBe('syncplay_member_left');
        expect(MessageTypes.TIME_PONG).toBe('syncplay_time_pong');
        expect(MessageTypes.TIME_SYNC).toBe('syncplay_time_sync');
        expect(MessageTypes.ERROR).toBe('syncplay_error');
        expect(MessageTypes.INFO).toBe('syncplay_info');
    });
});

describe('PlaybackState', () => {
    it('should have correct playback state values', () => {
        expect(PlaybackState.PLAYING).toBe('playing');
        expect(PlaybackState.PAUSED).toBe('paused');
        expect(PlaybackState.BUFFERING).toBe('buffering');
    });
});
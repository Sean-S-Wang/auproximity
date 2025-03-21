import {BackendAdapter, ImpostorBackendModel, RoomGroup} from "../types/Backend";
import {HubConnection, HubConnectionBuilder} from "@microsoft/signalr";
import {Pose} from "../Client";
import {IMPOSTOR_BACKEND_PORT} from "../consts";
import * as _ from "lodash";

export default class ImpostorBackend extends BackendAdapter {
    backendModel: ImpostorBackendModel
    connection!: HubConnection;
    constructor(backendModel: ImpostorBackendModel) {
        super();
        this.backendModel = backendModel;
    }

    throttledEmitPlayerMove = _.throttle(this.emitPlayerPose,this.backendModel.throttle)

    initialize(): void {
        // Print throttle to console
        console.log(this.backendModel.throttle)
        try {
            this.connection = new HubConnectionBuilder()
                .withUrl(`http://${this.backendModel.ip}:${IMPOSTOR_BACKEND_PORT}/hub`).build();
            this.connection.on(ImpostorSocketEvents.MapChange, (id: number) => {
                this.emitMapChange(id);
            });
            this.connection.on(ImpostorSocketEvents.GameStarted, () => {
                this.emitAllPlayerJoinGroups(RoomGroup.Main);
            });
            this.connection.on(ImpostorSocketEvents.PlayerMove, (name: string, pose: Pose) => {
                this.throttledEmitPlayerMove(name, pose);
            });
            this.connection.on(ImpostorSocketEvents.MeetingCalled, () => {
                this.emitAllPlayerPoses({ x: 0, y: 0 });
            });
            this.connection.on(ImpostorSocketEvents.PlayerExiled, (name: string) => {
                this.emitPlayerJoinGroup(name, RoomGroup.Spectator);
            });
            this.connection.on(ImpostorSocketEvents.CommsSabotage, (fix: boolean) => {
                if (fix) {
                    this.emitPlayerFromJoinGroup(RoomGroup.Muted, RoomGroup.Main);
                } else {
                    this.emitPlayerFromJoinGroup(RoomGroup.Main, RoomGroup.Muted);
                }
            });
            this.connection.on(ImpostorSocketEvents.GameEnd, () => {
                this.emitAllPlayerJoinGroups(RoomGroup.Spectator);
            });

            console.log(`Initialized Impostor Backend at http://${this.backendModel.ip}:${IMPOSTOR_BACKEND_PORT}/hub`);
            this.connection.start()
                .then(() => this.connection.send(ImpostorSocketEvents.TrackGame, this.backendModel.gameCode))
                .catch(err => console.log(`Error in ImpostorBackend: ${err}`));
        } catch (err) {
            console.log(`Error in ImpostorBackend: ${err}`);
        }
    }
    async destroy(): Promise<void> {
        console.log(`Destroyed Impostor Backend at http://${this.backendModel.ip}:${IMPOSTOR_BACKEND_PORT}/hub`);
        return await this.connection.stop();
    }
}

export enum ImpostorSocketEvents {
    TrackGame  = "TrackGame",
    MapChange = "MapChange",
    GameStarted = "GameStarted",
    PlayerMove = "PlayerMove",
    MeetingCalled = "MeetingCalled",
    PlayerExiled = "PlayerExiled",
    CommsSabotage = "CommsSabotage",
    GameEnd = "GameEnd"
}

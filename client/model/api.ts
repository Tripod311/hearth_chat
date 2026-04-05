import { Pump, Pipe } from "@tripod311/pump"

import LoginRequest from "./user/login.js"
import LogoutRequest from "./user/logout.js"
import VerifyRequest from "./user/verify.js"
import GetUsersRequest from "./user/getUsers.js"
import SetPasswordRequest from "./user/setPassword.js"
import AddUserRequest from "./user/addUser.js"
import DeleteUserRequest from "./user/deleteUser.js"
import EditUserRequest from "./user/editUser.js"
import CreateInviteRequest from "./user/createInvite.js"
import AcceptInviteRequest from "./user/acceptInvite.js"
import GetDisplayNameRequest from "./user/getDisplayName.js"
import SetDisplayNameRequest from "./user/setDisplayName.js"

import MyTopicsRequest from "./topic/myTopics.js"
import CreateTopicRequest from "./topic/create.js"
import DeleteTopicRequest from "./topic/delete.js"
import UpdateTopicRequest from "./topic/update.js"
import AllTopicsRequest from "./topic/allTopics.js"
import WSRequest from "./topic/wsRequest.js"
import UploadFilesRequest from "./topic/uploadFiles.js"

import NodeTitleRequest from "./nodeInfo/fetchNodeTitle.js"
import TitlePageRequest from "./nodeInfo/titlePage.js"
import GetNodeSettingsRequest from "./nodeInfo/getNodeSettings.js"
import SetNodeSettingsRequest from "./nodeInfo/setNodeSettings.js"
import FetchVapidRequest from "./nodeInfo/fetchVapid.js"

import FetchRelatedRequest from "./related/fetchRelated.js"
import FetchHandshakesRequest from "./related/fetchHandshakes.js"
import AcceptHandshakeRequest from "./related/acceptHandshake.js"
import RejectHandshakeRequest from "./related/rejectHandshake.js"
import SendHandshakeRequest from "./related/sendHandshake.js"
import ForgetRelatedRequest from "./related/forgetRelated.js"
import GoToRequest from "./related/goTo.js"

import AddPushSubscriptionRequest from "./push/addPushSubscription.js"
import DeletePushSubscriptionRequest from "./push/deletePushSubscription.js"

import GetActorsRequest from "./actor/getActors.js"
import GetActorInfoRequest from "./actor/getActorInfo.js"
import BanRequest from "./actor/ban.js"
import UnbanRequest from "./actor/unban.js"

export default function addAPI (model: Pump) {
	const root = new Pipe();
	model.addPipe("api", root);

	const userRoot = new Pipe();
	root.addPipe("user", userRoot);
	userRoot.addPipe("login", LoginRequest);
	userRoot.addPipe("logout", LogoutRequest);
	userRoot.addPipe("verify", VerifyRequest);
	userRoot.addPipe("getUsers", GetUsersRequest);
	userRoot.addPipe("setPassword", SetPasswordRequest);
	userRoot.addPipe("addUser", AddUserRequest);
	userRoot.addPipe("deleteUser", DeleteUserRequest);
	userRoot.addPipe("editUser", EditUserRequest);
	userRoot.addPipe("createInvite", CreateInviteRequest);
	userRoot.addPipe("acceptInvite", AcceptInviteRequest);
	userRoot.addPipe("getDisplayName", GetDisplayNameRequest);
	userRoot.addPipe("setDisplayName", SetDisplayNameRequest);

	const topicRoot = new Pipe();
	root.addPipe("topic", topicRoot);
	topicRoot.addPipe("myTopics", MyTopicsRequest);
	topicRoot.addPipe("create", CreateTopicRequest);
	topicRoot.addPipe("update", UpdateTopicRequest);
	topicRoot.addPipe("delete", DeleteTopicRequest);
	topicRoot.addPipe("allTopics", AllTopicsRequest);
	topicRoot.addPipe("wsRequest", WSRequest);
	topicRoot.addPipe("uploadFiles", UploadFilesRequest);

	const nodeInfoRoot = new Pipe();
	root.addPipe("nodeInfo", nodeInfoRoot);
	nodeInfoRoot.addPipe("fetchNodeTitle", NodeTitleRequest);
	nodeInfoRoot.addPipe("titlePage", TitlePageRequest);
	nodeInfoRoot.addPipe("getNodeSettings", GetNodeSettingsRequest);
	nodeInfoRoot.addPipe("setNodeSettings", SetNodeSettingsRequest);
	nodeInfoRoot.addPipe("fetchVapid", FetchVapidRequest);

	const relatedRoot = new Pipe();
	root.addPipe("related", relatedRoot);
	relatedRoot.addPipe("fetchHandshakes", FetchHandshakesRequest);
	relatedRoot.addPipe("fetchRelated", FetchRelatedRequest);
	relatedRoot.addPipe("acceptHandshake", AcceptHandshakeRequest);
	relatedRoot.addPipe("rejectHandshake", RejectHandshakeRequest);
	relatedRoot.addPipe("sendHandshake", SendHandshakeRequest);
	relatedRoot.addPipe("forgetRelated", ForgetRelatedRequest);
	relatedRoot.addPipe("goTo", GoToRequest);

	const pushRoot = new Pipe();
	root.addPipe("push", pushRoot);
	pushRoot.addPipe("add", AddPushSubscriptionRequest);
	pushRoot.addPipe("delete", DeletePushSubscriptionRequest);

	const actorRoot = new Pipe();
	root.addPipe("actor", actorRoot);
	actorRoot.addPipe("getActors", GetActorsRequest);
	actorRoot.addPipe("getActorInfo", GetActorInfoRequest);
	actorRoot.addPipe("ban", BanRequest);
	actorRoot.addPipe("unban", UnbanRequest);
}
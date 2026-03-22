import Iter "mo:core/Iter";
import Order "mo:core/Order";
import Array "mo:core/Array";
import Map "mo:core/Map";
import Time "mo:core/Time";
import Text "mo:core/Text";
import List "mo:core/List";
import Runtime "mo:core/Runtime";
import Principal "mo:core/Principal";
import AccessControl "authorization/access-control";
import MixinAuthorization "authorization/MixinAuthorization";

actor {
  /// Authentication
  /// See Components section for instructions.
  let accessControlState = AccessControl.initState();
  include MixinAuthorization(accessControlState);

  /// Study subjects
  type Subject = {
    #math;
    #science;
    #history;
    #literature;
  };

  module Subject {
    public func compare(subject1 : Subject, subject2 : Subject) : Order.Order {
      compareNat(toNat(subject1), toNat(subject2));
    };

    func toNat(subject : Subject) : Nat {
      switch (subject) {
        case (#math) { 0 };
        case (#science) { 1 };
        case (#history) { 2 };
        case (#literature) { 3 };
      };
    };

    func compareNat(n1 : Nat, n2 : Nat) : Order.Order {
      if (n1 < n2) #less else if (n1 > n2) #greater else #equal;
    };
  };

  let subjects : [Subject] = [#math, #science, #history, #literature];

  public query ({ caller }) func getSubjects() : async [Subject] {
    // Public access - anyone including guests can browse subjects
    subjects;
  };

  type Message = {
    id : Nat;
    sender : Principal;
    question : Text;
    answer : Text;
    subject : Subject;
    timestamp : Time.Time;
  };

  /// AI chat messages
  var nextMessageId = 0;
  let messages = Map.empty<Nat, Message>();

  func createMessage(sender : Principal, question : Text, answer : Text, subject : Subject) : Message {
    let id = nextMessageId;
    nextMessageId += 1;
    {
      id;
      sender;
      question;
      answer;
      subject;
      timestamp = Time.now();
    };
  };

  public shared ({ caller }) func askQuestion(question : Text, subject : Subject) : async Message {
    if (not (AccessControl.hasPermission(accessControlState, caller, #user))) {
      Runtime.trap("Unauthorized: Only users can ask questions");
    };
    if (question.size() == 0) { Runtime.trap("Question cannot be empty") };
    let answer = "StudyBuddy: That's a great question! The answer is: 42.";
    let message = createMessage(caller, question, answer, subject);
    messages.add(message.id, message);
    message;
  };

  public query ({ caller }) func getMessage(messageId : Nat) : async ?Message {
    switch (messages.get(messageId)) {
      case (null) { null };
      case (?message) {
        // Users can only view their own messages, admins can view all
        if (message.sender != caller and not AccessControl.isAdmin(accessControlState, caller)) {
          Runtime.trap("Unauthorized: Can only view your own messages");
        };
        ?message;
      };
    };
  };

  public query ({ caller }) func getAllMessages() : async [Message] {
    // Only admins can view all messages
    if (not (AccessControl.hasPermission(accessControlState, caller, #admin))) {
      Runtime.trap("Unauthorized: Only admins can view all messages");
    };
    messages.values().toArray();
  };

  public query ({ caller }) func getMessagesByUser(user : Principal) : async [Message] {
    // Users can only view their own messages, admins can view any user's messages
    if (caller != user and not AccessControl.isAdmin(accessControlState, caller)) {
      Runtime.trap("Unauthorized: Can only view your own messages");
    };
    messages.values().toArray().filter(func(m) { m.sender == user });
  };

  /// Study progress tracking
  type StudyProgress = {
    questionsAsked : Nat;
    messages : [Nat];
    subjectsVisited : [Subject];
  };

  let studyProgress = Map.empty<Principal, StudyProgress>();

  public shared ({ caller }) func recordStudySession(subject : Subject, questionCount : Nat) : async () {
    if (not (AccessControl.hasPermission(accessControlState, caller, #user))) {
      Runtime.trap("Unauthorized: Only users can record study sessions");
    };
    let currentProgress = switch (studyProgress.get(caller)) {
      case (null) {
        {
          questionsAsked = 0;
          messages = [];
          subjectsVisited = [];
        };
      };
      case (?progress) { progress };
    };
    let newSubjectsVisited = currentProgress.subjectsVisited.concat([subject]);
    let newProgress = {
      questionsAsked = currentProgress.questionsAsked + questionCount;
      messages = currentProgress.messages;
      subjectsVisited = newSubjectsVisited;
    };
    if (questionCount > 0) { studyProgress.add(caller, newProgress) } else { Runtime.trap("No questions asked") };
  };

  public query ({ caller }) func getCallerStudyProgress() : async StudyProgress {
    if (not (AccessControl.hasPermission(accessControlState, caller, #user))) {
      Runtime.trap("Unauthorized: Only users can view study progress");
    };
    switch (studyProgress.get(caller)) {
      case (null) { Runtime.trap("No progress found") };
      case (?progress) { progress };
    };
  };

  public query ({ caller }) func getStudyProgress(user : Principal) : async StudyProgress {
    // Users can only view their own progress, admins can view any user's progress
    if (caller != user and not AccessControl.isAdmin(accessControlState, caller)) {
      Runtime.trap("Unauthorized: Can only view your own progress");
    };
    switch (studyProgress.get(user)) {
      case (null) { Runtime.trap("No progress found for user " # user.toText()) };
      case (?progress) { progress };
    };
  };

  /// Calculate user with most questions asked
  public query ({ caller }) func getMostStudiousUser() : async ?Principal {
    // Only users can view statistics
    if (not (AccessControl.hasPermission(accessControlState, caller, #user))) {
      Runtime.trap("Unauthorized: Only users can view statistics");
    };
    var maxUser : ?Principal = null;
    var maxQuestions = 0;

    studyProgress.keys().forEach(
      func(user) {
        switch (studyProgress.get(user)) {
          case (null) {};
          case (?progress) {
            if (progress.questionsAsked > maxQuestions) {
              maxQuestions := progress.questionsAsked;
              maxUser := ?user;
            };
          };
        };
      }
    );
    maxUser;
  };

  /// Get subject with most questions asked
  public query ({ caller }) func getMostPopularSubject() : async ?Subject {
    // Only users can view statistics
    if (not (AccessControl.hasPermission(accessControlState, caller, #user))) {
      Runtime.trap("Unauthorized: Only users can view statistics");
    };
    let subjectStatsList = List.empty<(Subject, Nat)>();
    for (subject in subjects.values()) {
      let count = messages.values().toArray().filter(func(m) { m.subject == subject }).size();
      subjectStatsList.add((subject, count));
    };

    let subjectCounts = subjectStatsList.toArray();
    switch (subjectCounts.size()) {
      case (0) { null };
      case (_) {
        var maxSubject = subjectCounts[0].0;
        var maxCount = subjectCounts[0].1;

        for ((subject, count) in subjectCounts.values()) {
          if (count > maxCount) {
            maxSubject := subject;
            maxCount := count;
          };
        };
        ?maxSubject;
      };
    };
  };
};

/*

Jappix - An open social platform
These are the microblog JS scripts for Jappix

-------------------------------------------------

License: AGPL
Authors: Valérian Saliou, Maranda

*/

// Bundle
var Microblog = (function () {

    /**
     * Alias of this
     * @private
     */
    var self = {};


    /**
     * Completes arrays of an entry's attached files
     * @public
     * @param {string} selector
     * @param {object} tFName
     * @param {object} tFURL
     * @param {object} tFThumb
     * @param {object} tFSource
     * @param {object} tFLength
     * @param {object} tFEComments
     * @param {object} tFNComments
     * @return {undefined}
     */
    self.attached = function(selector, tFName, tFURL, tFThumb, tFSource, tFType, tFLength, tFEComments, tFNComments) {

        try {
            tFName.push($(selector).attr('title') || '');
            tFURL.push($(selector).attr('href') || '');
            tFThumb.push($(selector).find('link[rel="self"][title="thumb"]:first').attr('href') || '');
            tFSource.push($(selector).attr('source') || '');
            tFType.push($(selector).attr('type') || '');
            tFLength.push($(selector).attr('length') || '');

            // Comments?
            var comments_href_c = $(selector).find('link[rel="replies"][title="comments_file"]:first').attr('href');

            if(comments_href_c && comments_href_c.match(/^xmpp:(.+)\?;node=(.+)/)) {
                tFEComments.push(RegExp.$1);
                tFNComments.push(decodeURIComponent(RegExp.$2));
            } else {
                tFEComments.push('');
                tFNComments.push('');
            }
        } catch(e) {
            Console.error('Microblog.attached', e);
        }

    };


    /**
     * Displays a given microblog item
     * @public
     * @param {object} packet
     * @param {string} from
     * @param {string} hash
     * @param {string} mode
     * @param {string} way
     * @return {undefined}
     */
    self.display = function(packet, from, hash, mode, way) {

        try {
            // Get some values
            var iParse = $(packet.getNode()).find('items item');

            iParse.each(function() {
                var this_sel = $(this);

                // Initialize
                var tContent, tFiltered, tTime, tDate, tStamp, tBody, tName, tID, tHash, tIndividual, tFEClick;
                var tHTMLEscape = false;

                // Arrays
                var tFName = [];
                var tFURL = [];
                var tFThumb = [];
                var tFSource = [];
                var tFType = [];
                var tFLength = [];
                var tFEComments = [];
                var tFNComments = [];
                var aFURL = [];
                var aFCat = [];

                // Get the values
                tDate = this_sel.find('published').text();
                tBody = this_sel.find('body').text();
                tID = this_sel.attr('id');
                tName = Name.getBuddy(from);
                tHash = 'update-' + hex_md5(tName + tDate + tID);

                // Read attached files with a thumb (place them at first)
                this_sel.find('link[rel="enclosure"]:has(link[rel="self"][title="thumb"])').each(function() {
                    self.attached(this, tFName, tFURL, tFThumb, tFSource, tFType, tFLength, tFEComments, tFNComments);
                });

                // Read attached files without any thumb
                this_sel.find('link[rel="enclosure"]:not(:has(link[rel="self"][title="thumb"]))').each(function() {
                    self.attached(this, tFName, tFURL, tFThumb, tFSource, tFType, tFLength, tFEComments, tFNComments);
                });

                // Get the repeat value
                var uRepeat = [this_sel.find('author name').text(), Common.explodeThis(':', this_sel.find('author uri').text(), 1)];
                var uRepeated = false;

                if(!uRepeat[0])
                    uRepeat = [Name.getBuddy(from), uRepeat[1]];
                if(!uRepeat[1])
                    uRepeat = [uRepeat[0], from];

                // Repeated?
                if(uRepeat[1] != from)
                    uRepeated = true;

                // Get the comments node
                var entityComments, nodeComments;

                // Get the comments
                var comments_href = this_sel.find('link[title="comments"]:first').attr('href');

                if(comments_href && comments_href.match(/^xmpp:(.+)\?;node=(.+)/)) {
                    entityComments = RegExp.$1;
                    nodeComments = decodeURIComponent(RegExp.$2);
                }

                // No comments node?
                if(!entityComments || !nodeComments) {
                    entityComments = '';
                    nodeComments = '';
                }

                // Get the stamp & time
                if(tDate) {
                    tStamp = DateUtils.extractStamp(Date.jab2date(tDate));
                    tTime = DateUtils.relative(tDate);
                }

                else {
                    tStamp = DateUtils.getTimeStamp();
                    tTime = '';
                }

                // Get the item geoloc
                var tGeoloc = '';
                var sGeoloc = this_sel.find('geoloc:first');
                var gLat = sGeoloc.find('lat').text();
                var gLon = sGeoloc.find('lon').text();

                if(gLat && gLon) {
                    tGeoloc += '<a class="geoloc talk-images" href="http://maps.google.com/?q=' + Common.encodeQuotes(gLat) + ',' + Common.encodeQuotes(gLon) + '" target="_blank">';

                    // Human-readable name?
                    var gHuman = PEP.humanPosition(
                        sGeoloc.find('locality').text(),
                        sGeoloc.find('region').text(),
                        sGeoloc.find('country').text()
                    );

                    if(gHuman) {
                        tGeoloc += gHuman.htmlEnc();
                    } else {
                        tGeoloc += gLat.htmlEnc() + '; ' + gLon.htmlEnc();
                    }

                    tGeoloc += '</a>';
                }

                // Entry content: HTML, parse!
                if(this_sel.find('content[type="html"]').size()) {
                    // Filter the xHTML message
                    tContent = Filter.xhtml(this);
                    tHTMLEscape = false;
                }

                // Entry content: Fallback on PLAIN?
                if(!tContent) {
                    tContent = this_sel.find('content[type="text"]').text();

                    if(!tContent) {
                        // Legacy?
                        tContent = this_sel.find('title:not(source > title)').text();

                        // Last chance?
                        if(!tContent) {
                            tContent = tBody;
                        }
                    }

                    // Trim the content
                    tContent = $.trim(tContent);
                    tHTMLEscape = true;
                }

                // Any content?
                if(tContent) {
                    // Apply links to message body
                    tFiltered = Filter.message(tContent, tName.htmlEnc(), tHTMLEscape);

                    // Display the received message
                    var html = '<div class="one-update update_' + hash + ' ' + tHash + '" data-stamp="' + Common.encodeQuotes(tStamp) + '" data-id="' + Common.encodeQuotes(tID) + '" data-xid="' + Common.encodeQuotes(from) + '">' +
                            '<div class="' + hash + '">' +
                                '<div class="avatar-container">' +
                                    '<img class="avatar" src="' + './images/others/default-avatar.png' + '" alt="" />' +
                                '</div>' +
                            '</div>' +

                            '<div class="body">' +
                                '<p>';

                    // Is it a repeat?
                    if(uRepeated)
                        html += '<a href="#" class="repeat talk-images" title="' + Common.encodeQuotes(Common.printf(Common._e("This is a repeat from %s"), uRepeat[0] + ' (' + uRepeat[1] + ')')) + '" onclick="return Chat.checkCreate(\'' + Utils.encodeOnclick(uRepeat[1]) + '\', \'chat\');" data-xid="' + Common.encodeQuotes(uRepeat[1]) + '"></a>';

                    html += '<b title="' + from + '" class="name">' + tName.htmlEnc() + '</b> <span>' + tFiltered + '</span></p>' +
                        '<p class="infos">' + tTime + tGeoloc + '</p>';

                    // Any file to display?
                    if(tFURL.length)
                        html += '<p class="file">';

                    // Generate an array of the files URL
                    for(var a = 0; a < tFURL.length; a++) {
                        // Not enough data?
                        if(!tFURL[a]) {
                            continue;
                        }

                        // Push the current URL! (YouTube or file)
                        if(tFURL[a].match(/(\w{3,5})(:)(\S+)((\.youtube\.com\/watch(\?v|\?\S+v|\#\!v|\#\!\S+v)\=)|(youtu\.be\/))([^& ]+)((&amp;\S)|(&\S)|\s|$)/gim)) {
                            aFURL.push($.trim(RegExp.$8));
                            aFCat.push('youtube');
                        }

                        else if(IntegrateBox.can(Common.strAfterLast('.', tFURL[a]))) {
                            aFURL.push(tFURL[a]);
                            aFCat.push(Utils.fileCategory(Common.strAfterLast('.', tFURL[a])));
                        }
                    }

                    // Add each file code
                    for(var f = 0; f < tFURL.length; f++) {
                        // Not enough data?
                        if(!tFURL[f]) {
                            continue;
                        }

                        // Get the file type
                        var tFLink = tFURL[f];
                        var tFExt = Common.strAfterLast('.', tFLink);
                        var tFCat = Utils.fileCategory(tFExt);

                        // Youtube video?
                        if(tFLink.match(/(\w{3,5})(:)(\S+)((\.youtube\.com\/watch(\?v|\?\S+v|\#\!v|\#\!\S+v)\=)|(youtu\.be\/))([^& ]+)((&amp;\S)|(&\S)|\s|$)/gim)) {
                            tFLink = $.trim(RegExp.$8);
                            tFCat = 'youtube';
                        }

                        // Supported image/video/sound
                        if(IntegrateBox.can(tFExt) || (tFCat == 'youtube')) {
                            tFEClick = 'onclick="return IntegrateBox.apply(\'' + Utils.encodeOnclick(tFLink) + '\', \'' + Utils.encodeOnclick(tFCat) + '\', \'' + Utils.encodeOnclick(aFURL) + '\', \'' + Utils.encodeOnclick(aFCat) + '\', \'' + Utils.encodeOnclick(tFEComments) + '\', \'' + Utils.encodeOnclick(tFNComments) + '\', \'large\');" ';
                        } else {
                            tFEClick = '';
                        }

                        // Any thumbnail?
                        if(tFThumb[f]) {
                            html += '<a class="thumb" ' + tFEClick + 'href="' + Common.encodeQuotes(tFURL[f]) + '" target="_blank" title="' + Common.encodeQuotes(tFName[f]) + '" data-node="' + Common.encodeQuotes(tFNComments[f]) + '"><img src="' + Common.encodeQuotes(tFThumb[f]) + '" alt="" /></a>';
                        } else {
                            html += '<a class="' + Common.encodeQuotes(tFCat) + ' link talk-images" ' + tFEClick + 'href="' + Common.encodeQuotes(tFURL[f]) + '" target="_blank" data-node="' + Common.encodeQuotes(tFNComments[f]) + '">' + tFName[f].htmlEnc() + '</a>';
                        }
                    }

                    if(tFURL.length) {
                        html += '</p>';
                    }

                    // It's my own notice, we can remove it!
                    if(from == Common.getXID()) {
                        html += '<a href="#" onclick="return Microblog.remove(\'' + Utils.encodeOnclick(tID) + '\', \'' + Utils.encodeOnclick(tHash) + '\', \'' + Utils.encodeOnclick(entityComments) + '\', \'' + Utils.encodeOnclick(nodeComments) + '\');" title="' + Common._e("Remove this notice") + '" class="mbtool remove talk-images"></a>';
                    }

                    // Notice from another user
                    else {
                        // User profile
                        html += '<a href="#" title="' + Common._e("View profile") + '" class="mbtool profile talk-images" onclick="return UserInfos.open(\'' + Utils.encodeOnclick(from) + '\');"></a>';

                        // If PEP is enabled
                        if(Features.enabledPEP() && tHTMLEscape) {
                            html += '<a href="#" title="' + Common._e("Repeat this notice") + '" class="mbtool repost talk-images"></a>';
                        }
                    }

                    html += '</div><div class="comments-container" data-node="' + Common.encodeQuotes(nodeComments) + '"></div></div>';

                    // Mixed mode
                    if((mode == 'mixed') && !Common.exists('.mixed .' + tHash)) {
                        // Remove the old element
                        if(way == 'push') {
                            $('#channel .content.mixed .one-update.update_' + hash).remove();
                        }

                        // Get the nearest element
                        var nearest = Search.sortElementByStamp(tStamp, '#channel .mixed .one-update');

                        // Append the content at the right position (date relative)
                        if(nearest === 0) {
                            $('#channel .content.mixed').append(html);
                        } else {
                            $('#channel .one-update[data-stamp="' + nearest + '"]:first').before(html);
                        }

                        // Show the new item
                        if(way == 'push') {
                            $('#channel .content.mixed .one-update.' + tHash).fadeIn('fast');
                        } else {
                            $('#channel .content.mixed .one-update.' + tHash).show();
                        }

                        // Remove the old notices to make the DOM lighter
                        var oneUpdate = '#channel .content.mixed .one-update';

                        if($(oneUpdate).size() > 80) {
                            $(oneUpdate + ':last').remove();
                        }

                        // Click event on avatar/name
                        $('.mixed .' + tHash + ' .avatar-container, .mixed .' + tHash + ' .body b').click(function() {
                            self.get(from, hash);
                        });
                    }

                    // Individual mode
                    tIndividual = '#channel .content.individual.microblog-' + hash;

                    // Can append individual content?
                    var can_individual = true;

                    if($('#channel .top.individual input[name="comments"]').val() && Common.exists(tIndividual + ' .one-update')) {
                        can_individual = false;
                    }

                    if(can_individual && Common.exists(tIndividual) && !Common.exists('.individual .' + tHash)) {
                        if(mode == 'mixed') {
                            $(tIndividual).prepend(html);
                        } else {
                            $(tIndividual + ' a.more').before(html);
                        }

                        // Show the new item
                        if(way == 'push') {
                            $('#channel .content.individual .one-update.' + tHash).fadeIn('fast');
                        } else {
                            $('#channel .content.individual .one-update.' + tHash).show();
                        }

                        // Make 'more' link visible
                        $(tIndividual + ' a.more').css('visibility', 'visible');

                        // Click event on name (if not me!)
                        if(from != Common.getXID()) {
                            $('.individual .' + tHash + ' .avatar-container, .individual .' + tHash + ' .body b').click(function() {
                                Chat.checkCreate(from, 'chat');
                            });
                        }
                    }

                    // Apply the click event
                    $('.' + tHash + ' a.repost:not([data-event="true"])').click(function() {
                        return self.publish(tContent, tFName, tFURL, tFType, tFLength, tFThumb, uRepeat, entityComments, nodeComments, tFEComments, tFNComments);
                    })

                    .attr('data-event', 'true');

                    // Apply the hover event
                    if(nodeComments) {
                        $('.' + mode + ' .' + tHash).hover(function() {
                            self.showComments($(this), entityComments, nodeComments, tHash);
                        }, function() {
                            if($(this).find('div.comments a.one-comment.loading').size()) {
                                $(this).find('div.comments').remove();
                            }
                        });
                    }
                }
            });

            // Display the avatar of this buddy
            Avatar.get(from, 'cache', 'true', 'forget');
        } catch(e) {
            Console.error('Microblog.display', e);
        }

    };


    /**
     * Removes a given microblog item
     * @public
     * @param {string} id
     * @param {string} hash
     * @param {string} pserver
     * @param {string} cnode
     * @return {boolean}
     */
    self.remove = function(id, hash, pserver, cnode) {

        /* REF: http://xmpp.org/extensions/xep-0060.html#publisher-delete */

        try {
            // Initialize
            var selector = $('.' + hash);
            var get_last = false;

            // Get the latest item for the mixed mode
            if(Common.exists('#channel .content.mixed .' + hash)) {
                get_last = true;
            }

            // Remove the item from our DOM
            selector.fadeOut('fast', function() {
                $(this).remove();
            });

            // Send the IQ to remove the item (and get eventual error callback)
            // Also attempt to remove the comments node.
            var retract_iq = new JSJaCIQ();
            retract_iq.setType('set');

            retract_iq.appendNode('pubsub', {
                'xmlns': NS_PUBSUB
            }).appendChild(retract_iq.buildNode('retract', {
                'node': NS_URN_MBLOG,
                'xmlns': NS_PUBSUB
            })).appendChild(retract_iq.buildNode('item', {
                'id': id,
                'xmlns': NS_PUBSUB
            }));

            var comm_delete_iq;
            if(pserver !== '' && cnode !== '') {
                comm_delete_iq = new JSJaCIQ();
                comm_delete_iq.setType('set');
                comm_delete_iq.setTo(pserver);
                comm_delete_iq.appendNode('pubsub', {
                    'xmlns': 'http://jabber.org/protocol/pubsub#owner'
                }).appendChild(comm_delete_iq.buildNode('delete', {
                    'node': cnode,
                    'xmlns': 'http://jabber.org/protocol/pubsub#owner'
                }));
            }

            if(get_last) {
                if(comm_delete_iq) {
                    con.send(comm_delete_iq);
                }

                con.send(retract_iq, self.handleRemove);
            } else {
                if(comm_delete_iq) {
                    con.send(comm_delete_iq);
                }

                con.send(retract_iq, Errors.handleReply);
            }
        } catch(e) {
            Console.error('Microblog.remove', e);
        } finally {
            return false;
        }

    };


    /**
     * Handles the microblog item removal
     * @public
     * @param {object} iq
     * @return {undefined}
     */
    self.handleRemove = function(iq) {

        try {
            // Handle the error reply
            Errors.handleReply(iq);

            // Get the latest item
            self.request(Common.getXID(), '1', false, self.handleUpdateRemove);
        } catch(e) {
            Console.error('Microblog.handleRemove', e);
        }

    };


    /**
     * Handles the microblog update
     * @public
     * @param {object} iq
     * @return {undefined}
     */
    self.handleUpdateRemove = function(iq) {

        try {
            // Error?
            if(iq.getType() == 'error') {
                return;
            }

            // Initialize
            var xid = Common.bareXID(Common.getStanzaFrom(iq));
            var hash = hex_md5(xid);

            // Display the item!
            self.display(iq, xid, hash, 'mixed', 'push');
        } catch(e) {
            Console.error('Microblog.handleUpdateRemove', e);
        }

    };


    /**
     * Gets a given microblog comments node
     * @public
     * @param {string} server
     * @param {string} node
     * @param {string} id
     * @return {boolean}
     */
    self.getComments = function(server, node, id) {

        /* REF: http://xmpp.org/extensions/xep-0060.html#subscriber-retrieve-requestall */

        try {
            var iq = new JSJaCIQ();
            iq.setType('get');
            iq.setID('get_' + genID() + '-' + id);
            iq.setTo(server);

            var pubsub = iq.appendNode('pubsub', {
                'xmlns': NS_PUBSUB
            });

            pubsub.appendChild(iq.buildNode('items', {
                'node': node,
                'xmlns': NS_PUBSUB
            }));

            con.send(iq, self.handleComments);
        } catch(e) {
            Console.error('Microblog.getComments', e);
        } finally {
            return false;
        }

    };


    /**
     * Handles a microblog comments node items
     * @public
     * @param {object} iq
     * @return {undefined}
     */
    self.handleComments = function(iq) {

        try {
            // Path
            var id = Common.explodeThis('-', iq.getID(), 1);
            var path = 'div.comments[data-id="' + id + '"] div.comments-content';

            // Does not exist?
            if(!Common.exists(path)) {
                return false;
            }

            var path_sel = $(path);

            // Any error?
            if(Errors.handleReply(iq)) {
                path_sel.html('<div class="one-comment loading">' + Common._e("Could not get the comments!") + '</div>');

                return false;
            }

            // Initialize
            var data = iq.getNode();
            var server = Common.bareXID(Common.getStanzaFrom(iq));
            var node = $(data).find('items:first').attr('node');
            var users_xid = [];
            var code = '';

            // No node?
            if(!node) {
                node = $(data).find('publish:first').attr('node');
            }

            // Get the parent microblog item
            var parent_select = $('#channel .one-update:has(*[data-node="' + node + '"])');
            var parent_data = [parent_select.attr('data-xid'), NS_URN_MBLOG, parent_select.attr('data-id')];

            // Get the owner XID
            var owner_xid = parent_select.attr('data-xid');
            var repeat_xid = parent_select.find('a.repeat').attr('data-xid');

            // Must we create the complete DOM?
            var complete = true;

            if(path_sel.find('.one-comment.compose').size()) {
                complete = false;
            }

            // Add the comment tool
            if(complete) {
                code += '<div class="one-comment compose">' +
                            '<span class="icon talk-images"></span><input type="text" placeholder="' + Common._e("Type your comment here...") + '" />' +
                        '</div>';
            }

            // Append the comments
            $(data).find('item').each(function() {
                var this_sel = $(this);

                // Get comment
                var current_id = this_sel.attr('id');
                var current_xid = Common.explodeThis(':', this_sel.find('author uri').text(), 1);
                var current_name = this_sel.find('author name').text();
                var current_date = this_sel.find('published').text();
                var current_body = this_sel.find('content[type="text"]').text();
                var current_bname = Name.getBuddy(current_xid);

                // Legacy?
                if(!current_body) {
                    current_body = this_sel.find('title:not(source > title)').text();
                }

                // Yet displayed? (continue the loop)
                if(path_sel.find('.one-comment[data-id="' + current_id + '"]').size()) {
                    return;
                }

                // No XID?
                if(!current_xid) {
                    current_xid = '';

                    if(!current_name) {
                        current_name = Common._e("unknown");
                    }
                }

                else if(!current_name || (current_bname != Common.getXIDNick(current_xid))) {
                    current_name = current_bname;
                }

                // Any date?
                if(current_date) {
                    current_date = DateUtils.relative(current_date);
                } else {
                    current_date = DateUtils.getCompleteTime();
                }

                // Click event
                var onclick = 'false';

                if(current_xid != Common.getXID()) {
                    onclick = 'Chat.checkCreate(\'' + Utils.encodeOnclick(current_xid) + '\', \'chat\')';
                }

                // If this is my comment, add a marker
                var type = 'him';
                var marker = '';
                var remove = '';

                if(current_xid == Common.getXID()) {
                    type = 'me';
                    marker = '<div class="marker"></div>';
                    remove = '<a href="#" class="remove" onclick="return Microblog.removeComment(\'' + Utils.encodeOnclick(server) + '\', \'' + Utils.encodeOnclick(node) + '\', \'' + Utils.encodeOnclick(current_id) + '\');">' + Common._e("Remove") + '</a>';
                }

                // New comment?
                var new_class = '';

                if(!complete) {
                    new_class = ' new';
                }

                // Add the comment
                if(current_body) {
                    // Add the XID
                    if(!Utils.existArrayValue(users_xid, current_xid)) {
                        users_xid.push(current_xid);
                    }

                    // Add the HTML code
                    code = '<div class="one-comment ' + hex_md5(current_xid) + ' ' + type + new_class + '" data-id="' + Common.encodeQuotes(current_id) + '">' +
                                marker +

                                '<div class="avatar-container" onclick="return ' + onclick + ';">' +
                                    '<img class="avatar" src="' + './images/others/default-avatar.png' + '" alt="" />' +
                                '</div>' +

                                '<div class="comment-container">' +
                                    '<a href="#" onclick="return ' + onclick + ';" title="' + Common.encodeQuotes(current_xid) + '" class="name">' + current_name.htmlEnc() + '</a>' +
                                    '<span class="date">' + current_date.htmlEnc() + '</span>' +
                                    remove +

                                    '<p class="body">' + Filter.message(current_body, current_name, true) + '</p>' +
                                '</div>' +

                                '<div class="clear"></div>' +
                           '</div>' + code;
                }
            });

            // Add the HTML
            if(complete) {
                path_sel.html(code);

                // Focus on the compose input
                $(document).oneTime(10, function() {
                    path_sel.find('.one-comment.compose input').focus();
                });
            }

            else {
                path_sel.find('.one-comment.compose').before(code);

                // Beautiful effect
                path_sel.find('.one-comment.new').slideDown('fast', function() {
                    self.adaptComment(id);
                }).removeClass('new');
            }

            // Set the good widths
            self.adaptComment(id);

            // Get the avatars
            for(var a in users_xid) {
                Avatar.get(users_xid[a], 'cache', 'true', 'forget');
            }

            // Add the owner XID
            if(owner_xid && owner_xid.match('@') && !Utils.existArrayValue(users_xid, owner_xid)) {
                users_xid.push(owner_xid);
            }

            // Add the repeated from XID
            if(repeat_xid && repeat_xid.match('@') && !Utils.existArrayValue(users_xid, repeat_xid)) {
                users_xid.push(repeat_xid);
            }

            // Remove my own XID
            Utils.removeArrayValue(users_xid, Common.getXID());

            // DOM events
            if(complete) {
                // Update timer
                path_sel.everyTime('60s', function() {
                    self.getComments(server, node, id);

                    Console.log('Updating comments node: ' + node + ' on ' + server + '...');
                });

                // Input key event
                var comment_compose_input_sel = path_sel.find('.one-comment.compose input');

                comment_compose_input_sel.placeholder();
                comment_compose_input_sel.keyup(function(e) {
                    var this_input_sel = $(this);

                    if((e.keyCode == 13) && this_input_sel.val()) {
                        // Send the comment!
                        self.sendComment(this_input_sel.val(), server, node, id, users_xid, parent_data);

                        // Reset the input value
                        this_input_sel.val('');

                        return false;
                    }
                });
            }
        } catch(e) {
            Console.error('Microblog.handleComments', e);
        }

    };


    /**
     * Shows the microblog comments box
     * @public
     * @param {string} path
     * @param {string} entityComments
     * @param {string} nodeComments
     * @param {string} tHash
     * @return {undefined}
     */
    self.showComments = function(path, entityComments, nodeComments, tHash) {

        try {
            // Do not display it twice!
            if(path.find('div.comments').size())
                return;

            // Generate an unique ID
            var idComments = genID();

            // Create comments container
            path.find('div.comments-container').append(
                '<div class="comments" data-id="' + Common.encodeQuotes(idComments) + '">' +
                    '<div class="arrow talk-images"></div>' +
                    '<div class="comments-content">' +
                        '<a href="#" class="one-comment loading"><span class="icon talk-images"></span>' + Common._e("Show comments") + '</a>' +
                    '</div>' +
                '</div>'
            );

            // Click event
            path.find('div.comments a.one-comment').click(function() {
                // Set loading info
                $(this).parent().html('<div class="one-comment loading"><span class="icon talk-images"></span>' + Common._e("Loading comments...") + '</div>');

                // Request comments
                self.getComments(entityComments, nodeComments, idComments);

                // Remove the comments from the DOM if click away
                if(tHash) {
                    $('#channel').off('click');

                    $('#channel').on('click', function(evt) {
                        if(!$(evt.target).parents('.' + tHash).size()) {
                            $('#channel').off('click');
                            $('#channel .one-update div.comments-content').stopTime();
                            $('#channel .one-update div.comments').remove();
                        }
                    });
                }

                return false;
            });
        } catch(e) {
            Console.error('Microblog.showComments', e);
        }

    };


    /**
     * Sends a comment on a given microblog comments node
     * @public
     * @param {string} value
     * @param {string} server
     * @param {string} node
     * @param {string} id
     * @param {object} notifiy_arr
     * @param {string} parent_data
     * @return {boolean}
     */
    self.sendComment = function(value, server, node, id, notifiy_arr, parent_data) {

        /* REF: http://xmpp.org/extensions/xep-0060.html#publisher-publish */

        try {
            // Not enough data?
            if(!value || !server || !node) {
                return false;
            }

            // Get some values
            var date = DateUtils.getXMPPTime('utc');
            var hash = hex_md5(value + date);

            // New IQ
            var iq = new JSJaCIQ();
            iq.setType('set');
            iq.setTo(server);
            iq.setID('set_' + genID() + '-' + id);

            // PubSub main elements
            var pubsub = iq.appendNode('pubsub', {
                'xmlns': NS_PUBSUB
            });

            var publish = pubsub.appendChild(iq.buildNode('publish', {
                'node': node,
                'xmlns': NS_PUBSUB
            }));

            var item = publish.appendChild(iq.buildNode('item', {
                'id': hash,
                'xmlns': NS_PUBSUB
            }));

            var entry = item.appendChild(iq.buildNode('entry', {
                'xmlns': NS_ATOM
            }));

            entry.appendChild(iq.buildNode('title', {
                'xmlns': NS_ATOM
            }));

            // Author infos
            var author = entry.appendChild(iq.buildNode('author', {
                'xmlns': NS_ATOM
            }));

            author.appendChild(iq.buildNode('name', {
                'xmlns': NS_ATOM
            }, Name.get()));

            author.appendChild(iq.buildNode('uri', {
                'xmlns': NS_ATOM
            }, 'xmpp:' + Common.getXID()));

            // Create the comment
            entry.appendChild(iq.buildNode('content', {
                'type': 'text',
                'xmlns': NS_ATOM
            }, value));

            entry.appendChild(iq.buildNode('published', {
                'xmlns': NS_ATOM
            }, date));

            con.send(iq);

            // Handle this comment!
            iq.setFrom(server);
            self.handleComments(iq);

            // Notify users
            if(notifiy_arr && notifiy_arr.length) {
                // XMPP link to the item
                var href = 'xmpp:' + server + '?;node=' + encodeURIComponent(node) + ';item=' + encodeURIComponent(hash);

                // Loop!
                for(var n in notifiy_arr) {
                    Notification.send(notifiy_arr[n], 'comment', href, value, parent_data);
                }
            }
        } catch(e) {
            Console.error('Microblog.sendComment', e);
        } finally {
            return false;
        }

    };


    /**
     * Removes a given microblog comment item
     * @public
     * @param {string} server
     * @param {string} node
     * @param {string} id
     * @return {undefined}
     */
    self.removeComment = function(server, node, id) {

        /* REF: http://xmpp.org/extensions/xep-0060.html#publisher-delete */

        try {
            // Remove the item from our DOM
            $('.one-comment[data-id="' + id + '"]').slideUp('fast', function() {
                var this_sel = $(this);

                // Get the parent ID
                var parent_id = this_sel.parents('div.comments').attr('data-id');

                // Remove it!
                this_sel.remove();

                // Adapt the width
                self.adaptComment(parent_id);
            });

            // Send the IQ to remove the item (and get eventual error callback)
            var iq = new JSJaCIQ();
            iq.setType('set');
            iq.setTo(server);

            var pubsub = iq.appendNode('pubsub', {
                'xmlns': NS_PUBSUB
            });

            var retract = pubsub.appendChild(iq.buildNode('retract', {
                'node': node,
                'xmlns': NS_PUBSUB
            }));

            retract.appendChild(iq.buildNode('item', {
                'id': id,
                'xmlns': NS_PUBSUB
            }));

            con.send(iq);
        } catch(e) {
            Console.error('Microblog.removeComment', e);
        } finally {
            return false;
        }

    };


    /**
     * Adapts the comment elements width
     * @public
     * @param {string} id
     * @return {undefined}
     */
    self.adaptComment = function(id) {

        try {
            var selector = $('div.comments[data-id="' + id + '"] div.comments-content');
            var selector_width = selector.width();

            // Change widths
            selector.find('.one-comment.compose input').css('width', selector_width - 60);
            selector.find('.one-comment .comment-container').css('width', selector_width - 55);
        } catch(e) {
            Console.error('Microblog.adaptComment', e);
        }

    };


    /**
     * Handles the microblog of an user
     * @public
     * @param {object} iq
     * @return {undefined}
     */
    self.handle = function(iq) {

        try {
            // Get the from attribute of this IQ
            var from = Common.bareXID(Common.getStanzaFrom(iq));

            // Define the selector path
            var selector = '#channel .top.individual input[name=';

            // Is this request still alive?
            if(from == $(selector + 'jid]').val()) {
                var hash = hex_md5(from);

                // Update the items counter
                var old_count = parseInt($(selector + 'counter]').val());
                $(selector + 'counter]').val(old_count + 20);

                // Display the microblog
                self.display(iq, from, hash, 'individual', 'request');

                // Hide the waiting icon
                self.wait(
                    Features.enabledPEP() ? 'sync' : 'unsync'
                );

                // Hide the 'more items' link?
                if($(iq.getNode()).find('item').size() < old_count)
                    $('#channel .individual a.more').remove();

                // Get the comments?
                var comments_node = $('#channel .top.individual input[name="comments"]').val();

                if(comments_node && comments_node.match(/^xmpp:(.+)\?;node=(.+);item=(.+)/)) {
                    // Get the values
                    var comments_entity = RegExp.$1;
                    comments_node = decodeURIComponent(RegExp.$2);

                    // Selectors
                    var file_link = $('#channel .individual .one-update p.file a[data-node="' + comments_node + '"]');
                    var entry_link = $('#channel .individual .one-update:has(.comments-container[data-node="' + comments_node + '"])');

                    // Is it a microblog entry (or a lonely entry file)?
                    if(entry_link.size()) {
                        self.showComments(entry_link, comments_entity, comments_node);
                        entry_link.find('a.one-comment').click();
                    }

                    // Is it a file?
                    else if(file_link.size()) {
                        file_link.click();
                    }
                }
            }

            Console.info('Microblog got: ' + from);
        } catch(e) {
            Console.error('Microblog.handle', e);
        }

    };


    /**
     * Handles the microblog of an user (from roster)
     * @public
     * @param {object} iq
     * @return {undefined}
     */
    self.handleRoster = function(iq) {

        try {
            // Get the from attribute of this IQ
            var from = Common.bareXID(Common.getStanzaFrom(iq));

            // Display the microblog
            self.display(iq, from, hex_md5(from), 'mixed', 'push');
        } catch(e) {
            Console.error('Microblog.handleRoster', e);
        }

    };


    /**
     * Resets the microblog elements
     * @public
     * @return {boolean}
     */
    self.reset = function() {

        try {
            var channel_sel = $('#channel');
            var individual_sel = channel_sel.find('.individual');

            // Reset everything
            individual_sel.find('.one-update div.comments-content').stopTime();
            individual_sel.remove();
            channel_sel.find('.mixed').show();

            // Hide the waiting icon
            self.wait(
                Features.enabledPEP() ? 'sync' : 'unsync'
            );
        } catch(e) {
            Console.error('Microblog.reset', e);
        } finally {
            return false;
        }

    };


    /**
     * Gets the user's microblog to check it exists
     * @public
     * @return {undefined}
     */
    self.getInit = function() {

        try {
            self.get(Common.getXID(), hex_md5(Common.getXID()), true);
        } catch(e) {
            Console.error('Microblog.getInit', e);
        }

    };


    /**
     * Handles the user's microblog to create it in case of error
     * @public
     * @param {object} iq
     * @return {undefined}
     */
    self.handleInit = function(iq) {

        try {
            // Any error?
            if((iq.getType() == 'error') && $(iq.getNode()).find('item-not-found').size()) {
                // The node may not exist, create it!
                Pubsub.setup('', NS_URN_MBLOG, '1', '1000000', '', '', true);

                Console.warn('Error while getting microblog, trying to reconfigure the PubSub node!');
            }
        } catch(e) {
            Console.error('Microblog.handleInit', e);
        }

    };


    /**
     * Requests an user's microblog
     * @public
     * @param {type} name
     * @return {undefined}
     */
    self.request = function(xid, items, get_item, handler) {

        try {
            // Ask the server the user's microblog
            var iq = new JSJaCIQ();
            iq.setType('get');
            iq.setTo(xid);

            var pubsub = iq.appendNode('pubsub', {
                'xmlns': NS_PUBSUB
            });

            var ps_items = pubsub.appendChild(iq.buildNode('items', {
                'node': NS_URN_MBLOG,
                'xmlns': NS_PUBSUB
            }));

            // Request a particular item?
            if(get_item) {
                ps_items.appendChild(iq.buildNode('item', {
                    'id': get_item,
                    'xmlns': NS_PUBSUB
                }));
            } else {
                ps_items.setAttribute('max_items', items);
            }

            if(handler) {
                con.send(iq, handler);
            } else {
                con.send(iq, self.handle);
            }
        } catch(e) {
            Console.error('Microblog.request', e);
        } finally {
            return false;
        }

    };


    /**
     * Gets the microblog of an user
     * @public
     * @param {string} xid
     * @param {string} hash
     * @param {boolean} check
     * @return {boolean}
     */
    self.get = function(xid, hash, check) {

        /* REF: http://xmpp.org/extensions/xep-0060.html#subscriber-retrieve */

        try {
            Console.info('Get the microblog: ' + xid);

            var channel_sel = $('#channel');

            // Fire the wait event
            self.wait('fetch');

            // XMPP URI?
            var get_item = '';

            if(xid.match(/^xmpp:(.+)\?;node=(.+);item=(.+)/)) {
                xid = RegExp.$1;
                get_item = decodeURIComponent(RegExp.$3);
            }

            // No hash?
            if(!hash) {
                hash = hex_md5(xid);
            }

            // Can display the individual channel?
            if(!check && !Common.exists('#channel .individual')) {
                // Hide the mixed channel
                channel_sel.find('.mixed').hide();

                // Get the channel title depending on the XID
                var cTitle;
                var cShortcuts = '';

                if(xid == Common.getXID()) {
                    cTitle = Common._e("Your channel");
                } else {
                    cTitle = Common._e("Channel of") + ' ' + Name.getBuddy(xid).htmlEnc();
                    cShortcuts = '<div class="shortcuts">' +
                                    '<a href="#" class="message talk-images" title="' + Common._e("Send him/her a message") + '" onclick="return Inbox.composeMessage(\'' + Utils.encodeOnclick(xid) + '\');"></a>' +
                                    '<a href="#" class="chat talk-images" title="' + Common._e("Start a chat with him/her") + '" onclick="return Chat.checkCreate(\'' + Utils.encodeOnclick(xid) + '\', \'chat\');"></a>' +
                                    '<a href="#" class="command talk-images" title="' + Common._e("Command") + '" onclick="return AdHoc.retrieve(\'' + Utils.encodeOnclick(xid) + '\');"></a>' +
                                    '<a href="#" class="profile talk-images" title="' + Common._e("Show user profile") + '" onclick="return UserInfos.open(\'' + Utils.encodeOnclick(xid) + '\');"></a>' +
                                 '</div>';
                }

                // Create a new individual channel
                channel_sel.find('.content.mixed').after(
                        '<div class="content individual microblog-' + hash + '">' +
                            '<a href="#" class="more home-images" onclick="if($(\'#channel .footer div.fetch\').is(\':hidden\')) { return Microblog.get(\'' + Utils.encodeOnclick(xid) + '\', \'' + Utils.encodeOnclick(hash) + '\'); } return false;">' + Common._e("More notices...") + '</a>' +
                        '</div>'
                                 )

                               .before(
                        '<div class="top individual ' + hash + '">' +
                            '<div class="avatar-container">' +
                                '<img class="avatar" src="' + './images/others/default-avatar.png' + '" alt="" />' +
                            '</div>' +

                            '<div class="update">' +
                                '<h2>' + cTitle + '</h2>' +
                                '<a href="#" onclick="return Microblog.reset();">« ' + Common._e("Previous") + '</a>' +
                            '</div>' +

                            cShortcuts +

                            '<input type="hidden" name="jid" value="' + Common.encodeQuotes(xid) + '" />' +
                            '<input type="hidden" name="counter" value="20" />' +
                        '</div>'
                                 );

                // Microblog navigation
                channel_sel.find('.content.individual').scroll(function() {
                    if(channel_sel.find('.footer div.fetch').is(':hidden') &&
                        channel_sel.find('.individual a.more:visible').size() &&
                        channel_sel.find('.content.individual').scrollTop() >= (channel_sel.find('.content.individual')[0].scrollHeight - channel_sel.find('.content.individual').height() - 200)) {
                        channel_sel.find('.individual a.more').click();
                    }
                });

                // Display the user avatar
                Avatar.get(xid, 'cache', 'true', 'forget');
            }

            // Get the number of items to retrieve
            var items = !check ? channel_sel.find('.top.individual input[name="counter"]').val() : '0';

            // Request
            self.request(
                xid,
                items,
                get_item,
                (check ? self.handleInit : self.handle)
            );
        } catch(e) {
            Console.error('Microblog.get', e);
        } finally {
            return false;
        }

    };


    /**
     * Show a given microblog waiting status
     * @public
     * @param {string} type
     * @return {undefined}
     */
    self.wait = function(type) {

        try {
            // First hide all the infos elements
            $('#channel .footer div').hide();

            // Display the good one
            $('#channel .footer div.' + type).show();

            // Depending on the type, disable/enable certain tools
            var selector = $('#channel .top input[name="microblog_body"]');

            if(type == 'unsync') {
                selector.attr('disabled', true);
            } else if(type == 'sync') {
                $(document).oneTime(10, function() {
                    selector.removeAttr('disabled').focus();
                });
            }
        } catch(e) {
            Console.error('Microblog.wait', e);
        }

    };


    /**
     * Gets the microblog configuration
     * @public
     * @return {undefined}
     */
    self.getConfig = function() {

        try {
            // Lock the microblog options
            $('#persistent, #maxnotices').attr('disabled', true);

            // Get the microblog configuration
            var iq = new JSJaCIQ();
            iq.setType('get');

            var pubsub = iq.appendNode('pubsub', {
                'xmlns': NS_PUBSUB_OWNER
            });

            pubsub.appendChild(iq.buildNode('configure', {
                'node': NS_URN_MBLOG,
                'xmlns': NS_PUBSUB_OWNER
            }));

            con.send(iq, self.handleGetConfig);
        } catch(e) {
            Console.error('Microblog.getConfig', e);
        }

    };


    /**
     * Handles the microblog configuration
     * @public
     * @param {object} iq
     * @return {undefined}
     */
    self.handleGetConfig = function(iq) {

        try {
            // Reset the options stuffs
            Options.wait('microblog');

            // Unlock the microblog options
            $('#persistent, #maxnotices').removeAttr('disabled');

            // End if not a result
            if(!iq || (iq.getType() != 'result')) {
                return;
            }

            // Initialize the values
            var selector = $(iq.getNode());
            var persistent = '0';
            var maxnotices = '1000000';

            // Get the values
            var xPersistent = selector.find('field[var="pubsub#persist_items"] value:first').text();
            var xMaxnotices = selector.find('field[var="pubsub#max_items"] value:first').text();

            // Any value?
            if(xPersistent) {
                persistent = xPersistent;
            }

            if(xMaxnotices) {
                maxnotices = xMaxnotices;
            }

            // Change the maxnotices value
            switch(maxnotices) {
                case '1':
                case '100':
                case '1000':
                case '10000':
                case '100000':
                case '1000000':
                    break;

                default:
                    maxnotices = '1000000';
                    break;
            }

            // Apply persistent value
            $('#persistent').attr(
                'checked',
                (persistent == '0' ? false : true)
            );

            // Apply maxnotices value
            $('#maxnotices').val(maxnotices);
        } catch(e) {
            Console.error('Microblog.handleGetConfig', e);
        }

    };


    /**
     * Handles the user's microblog
     * @public
     * @param {object} packet
     * @return {undefined}
     */
    self.handleMine = function(packet) {

        try {
            var input_body_sel = $('#channel .top input[name="microblog_body"]');

            // Reset the entire form
            input_body_sel.removeAttr('disabled').val('');
            input_body_sel.placeholder();

            self.unattach();

            // Check for errors
            Errors.handleReply(packet);
        } catch(e) {
            Console.error('Microblog.handleMy', e);
        }

    };


    /**
     * Performs the microblog sender checks
     * @public
     * @param {type} name
     * @return {boolean}
     */
    self.send = function() {

        try {
            // Get the values
            var selector = $('#channel .top input[name="microblog_body"]');
            var body = $.trim(selector.val());

            // Sufficient parameters
            if(body) {
                // Disable & blur our input
                selector.attr('disabled', true).blur();

                // Files array
                var fName = [];
                var fType = [];
                var fLength = [];
                var fURL = [];
                var fThumb = [];

                // Read the files
                $('#attach .one-file').each(function() {
                    var this_sel = $(this);

                    // Push the values!
                    fName.push(this_sel.find('a.link').text());
                    fType.push(this_sel.attr('data-type'));
                    fLength.push(this_sel.attr('data-length'));
                    fURL.push(this_sel.find('a.link').attr('href'));
                    fThumb.push(this_sel.attr('data-thumb'));
                });

                // Containing YouTube videos?
                var yt_matches = body.match(/(\w{3,5})(:)(\S+)((\.youtube\.com\/watch(\?v|\?\S+v|\#\!v|\#\!\S+v)\=)|(youtu\.be\/))([^& ]+)((&amp;\S)|(&\S)|\s|$)/gim);

                for(var y in yt_matches) {
                    fName.push('');
                    fType.push('text/html');
                    fLength.push('');
                    fURL.push($.trim(yt_matches[y]));
                    fThumb.push('https://img.youtube.com/vi/' + $.trim(yt_matches[y].replace(/(\w{3,5})(:)(\S+)((\.youtube\.com\/watch(\?v|\?\S+v|\#\!v|\#\!\S+v)\=)|(youtu\.be\/))([^& ]+)((&amp;\S)|(&\S)|\s|$)/gim, '$8')) + '/0.jpg');
                }

                // Send the message on the XMPP network
                self.publish(body, fName, fURL, fType, fLength, fThumb);
            }
        } catch(e) {
            Console.error('Microblog.send', e);
        } finally {
            return false;
        }

    };


    /**
     * Publishes a given microblog item
     * @public
     * @param {type} body
     * @param {type} attachedname
     * @param {type} attachedurl
     * @param {type} attachedtype
     * @param {type} attachedlength
     * @param {type} attachedthumb
     * @param {type} repeat
     * @param {type} comments_entity
     * @param {type} comments_node
     * @param {type} comments_entity_file
     * @param {type} comments_node_file
     * @return {boolean}
     */
    self.publish = function(body, attachedname, attachedurl, attachedtype, attachedlength, attachedthumb, repeat, comments_entity, comments_node, comments_entity_file, comments_node_file) {

        /* REF: http://xmpp.org/extensions/xep-0277.html */

        try {
            // Generate some values
            var time = DateUtils.getXMPPTime('utc');
            var id = hex_md5(body + time);
            var nick = Name.get();
            var xid = Common.getXID();

            // Define repeat options
            var author_nick = nick;
            var author_xid = xid;

            if(repeat && repeat.length) {
                author_nick = repeat[0];
                author_xid = repeat[1];
            }

            // Define comments options
            var node_create = false;

            if(!comments_entity || !comments_node) {
                node_create = true;
                comments_entity = HOST_PUBSUB;
                comments_node = NS_URN_MBLOG + ':comments/' + id;
            }

            if(!comments_entity_file) {
                comments_entity_file = [];
            }

            if(!comments_node_file) {
                comments_node_file = [];
            }

            // Don't create another comments node if only 1 file is attached
            if(attachedurl && (attachedurl.length == 1) && (!comments_entity_file[0] || !comments_node_file[0])) {
                comments_entity_file = [comments_entity];
                comments_node_file = [comments_node];
            }

            // New IQ
            var iq = new JSJaCIQ();
            iq.setType('set');
            iq.setTo(xid);

            // Create the main XML nodes/childs
            var pubsub = iq.appendNode('pubsub', {'xmlns': NS_PUBSUB});
            var publish = pubsub.appendChild(iq.buildNode('publish', {'node': NS_URN_MBLOG, 'xmlns': NS_PUBSUB}));
            var item = publish.appendChild(iq.buildNode('item', {'id': id, 'xmlns': NS_PUBSUB}));
            var entry = item.appendChild(iq.buildNode('entry', {'xmlns': NS_ATOM}));
            entry.appendChild(iq.buildNode('title', {'xmlns': NS_ATOM}));

            // Create the XML author childs
            var author = entry.appendChild(iq.buildNode('author', {'xmlns': NS_ATOM}));
            author.appendChild(iq.buildNode('name', {'xmlns': NS_ATOM}, author_nick));
            author.appendChild(iq.buildNode('uri', {'xmlns': NS_ATOM}, 'xmpp:' + author_xid));

            // Create the XML entry childs
            entry.appendChild(iq.buildNode('content', {'type': 'text', 'xmlns': NS_ATOM}, body));
            entry.appendChild(iq.buildNode('published', {'xmlns': NS_ATOM}, time));
            entry.appendChild(iq.buildNode('updated', {'xmlns': NS_ATOM}, time));
            entry.appendChild(iq.buildNode('link', {
                'rel': 'alternate',
                'href': 'xmpp:' + xid + '?;node=' + encodeURIComponent(NS_URN_MBLOG) + ';item=' + encodeURIComponent(id),
                'xmlns': NS_ATOM
            }));

            // Create the attached files nodes
            for(var i = 0; i < attachedurl.length; i++) {
                // Not enough data?
                if(!attachedurl[i]) {
                    continue;
                }

                // Append a new file element
                var file = entry.appendChild(iq.buildNode('link', {'xmlns': NS_ATOM, 'rel': 'enclosure', 'href': attachedurl[i]}));

                // Add attributes
                if(attachedname[i])
                    file.setAttribute('title', attachedname[i]);
                if(attachedtype[i])
                    file.setAttribute('type', attachedtype[i]);
                if(attachedlength[i])
                    file.setAttribute('length', attachedlength[i]);

                // Any thumbnail?
                if(attachedthumb[i]) {
                    file.appendChild(iq.buildNode('link', {'xmlns': NS_URN_MBLOG, 'rel': 'self', 'title': 'thumb', 'type': attachedtype[i], 'href': attachedthumb[i]}));
                }

                // Any comments node?
                if(!comments_entity_file[i] || !comments_node_file[i]) {
                    // Generate values
                    comments_entity_file[i] = HOST_PUBSUB;
                    comments_node_file[i] = NS_URN_MBLOG + ':comments/' + hex_md5(attachedurl[i] + attachedname[i] + attachedtype[i] + attachedlength[i] + time);

                    // Create the node
                    Pubsub.setup(comments_entity_file[i], comments_node_file[i], '1', '1000000', 'open', 'open', true);
                }

                file.appendChild(iq.buildNode('link', {'xmlns': NS_URN_MBLOG, 'rel': 'replies', 'title': 'comments_file', 'href': 'xmpp:' + comments_entity_file[i] + '?;node=' + encodeURIComponent(comments_node_file[i])}));
            }

            // Create the comments child
            entry.appendChild(iq.buildNode('link', {'xmlns': NS_ATOM, 'rel': 'replies', 'title': 'comments', 'href': 'xmpp:' + comments_entity + '?;node=' + encodeURIComponent(comments_node)}));

            // Create the geoloc child
            var geoloc_xml = DataStore.getDB(Connection.desktop_hash, 'geolocation', 'now');

            if(geoloc_xml) {
                // Create two position arrays
                var geo_names  = ['lat', 'lon', 'country', 'countrycode', 'region', 'postalcode', 'locality', 'street', 'building', 'text', 'uri', 'timestamp'];
                var geo_values = PEP.parsePosition(Common.XMLFromString(geoloc_xml));

                // New geoloc child
                var geoloc = entry.appendChild(iq.buildNode('geoloc', {
                    'xmlns': NS_GEOLOC
                }));

                // Append the geoloc content
                for(var g = 0; g < geo_names.length; g++) {
                    if(geo_names[g] && geo_values[g]) {
                        geoloc.appendChild(iq.buildNode(geo_names[g], {
                            'xmlns': NS_GEOLOC
                        }, geo_values[g]));
                    }
                }
            }

            // Send the IQ
            con.send(iq, self.handleMine);

            // Create the XML comments PubSub nodes
            if(node_create) {
                Pubsub.setup(comments_entity, comments_node, '1', '1000000', 'open', 'open', true);
            }
        } catch(e) {
            Console.error('Microblog.publish', e);
        } finally {
            return false;
        }

    };


    /**
     * Attaches a file to a microblog post
     * @public
     * @return {undefined}
     */
    self.attach = function() {

        try {
            // File upload vars
            var attach_options = {
                dataType:      'xml',
                beforeSubmit:   self.waitAttach,
                success:        self.handleAttach
            };

            // Upload form submit event
            $('#attach').submit(function() {
                if(!Common.exists('#attach .wait') && $('#attach input[type="file"]').val()) {
                    $(this).ajaxSubmit(attach_options);
                }

                return false;
            });

            // Upload input change event
            $('#attach input[type="file"]').change(function() {
                if(!Common.exists('#attach .wait') && $(this).val())
                    $('#attach').ajaxSubmit(attach_options);

                return false;
            });
        } catch(e) {
            Console.error('Microblog.attach', e);
        }

    };


    /**
     * Unattaches a microblog file
     * @public
     * @param {string} id
     * @return {boolean}
     */
    self.unattach = function(id) {

        try {
            // Individual removal?
            if(id) {
                $('#attach .one-file[data-id="' + id + '"]').remove();
            } else {
                $('#attach .one-file').remove();
            }

            // Must enable the popup again?
            if(!Common.exists('#attach .one-file')) {
                // Restore the bubble class
                $('#attach').addClass('bubble');

                // Enable the bubble click events
                if(id) {
                    $('#attach').hide();
                    Bubble.show('#attach');
                } else {
                    Bubble.close();
                }
            }
        } catch(e) {
            Console.error('Microblog.unattach', e);
        } finally {
            return false;
        }

    };


    /**
     * Wait event for file attaching
     * @public
     * @return {undefined}
     */
    self.waitAttach = function() {

        try {
            // Append the wait icon
            $('#attach input[type="submit"]').after('<div class="wait wait-medium"></div>');

            // Lock the bubble
            $('#attach').removeClass('bubble');
        } catch(e) {
            Console.error('Microblog.waitAttach', e);
        }

    };


    /**
     * Success event for file attaching
     * @public
     * @param {string} responseXML
     * @return {undefined}
     */
    self.handleAttach = function(responseXML) {

        try {
            // Data selector
            var dData = $(responseXML).find('jappix');

            // Process the returned data
            if(!dData.find('error').size()) {
                // Do not allow this bubble to be hidden
                $('#attach').removeClass('bubble');

                // Get the file values
                var fName = dData.find('title').text();
                var fType = dData.find('type').text();
                var fLength = dData.find('length').text();
                var fURL = dData.find('href').text();
                var fThumb = dData.find('thumb').text();

                // Generate a file ID
                var fID = hex_md5(fURL);

                // Add this file
                $('#attach .attach-subitem').append(
                    '<div class="one-file" data-type="' + Common.encodeQuotes(fType) + '" data-length="' + Common.encodeQuotes(fLength) + '" data-thumb="' + Common.encodeQuotes(fThumb) + '" data-id="' + fID + '">' +
                        '<a class="remove talk-images" href="#" title="' + Common.encodeQuotes(Common._e("Unattach the file")) + '"></a>' +
                        '<a class="link" href="' + Common.encodeQuotes(fURL) + '" target="_blank">' + fName.htmlEnc() + '</a>' +
                    '</div>'
                );

                // Click event
                $('#attach .one-file[data-id="' + fID + '"] a.remove').click(function() {
                    return self.unattach(fID);
                });

                Console.info('File attached.');
            }

            // Any error?
            else {
                Board.openThisError(4);

                // Unlock the bubble?
                if(!Common.exists('#attach .one-file')) {
                    $('#attach').addClass('bubble').hide();

                    // Show the bubble again!
                    Bubble.show('#attach');
                }

                Console.error('Error while attaching the file', dData.find('error').text());
            }

            // Reset the attach bubble
            $('#attach input[type="file"]').val('');
            $('#attach .wait').remove();

            // Focus on the text input
            $(document).oneTime(10, function() {
                $('#channel .top input[name="microblog_body"]').focus();
            });
        } catch(e) {
            Console.error('Microblog.handleAttach', e);
        }

    };


    /**
     * Shows the microblog of an user from his infos
     * @public
     * @param {string} xid
     * @param {string} hash
     * @return {undefined}
     */
    self.fromInfos = function(xid, hash) {

        try {
            // Renitialize the channel
            self.reset();

            // Switch to the channel
            Interface.switchChan('channel');

            // Get the microblog
            self.get(xid, hash);
        } catch(e) {
            Console.error('Microblog.fromInfos', e);
        }

    };


    /**
     * Plugin launcher
     * @public
     * @return {undefined}
     */
    self.instance = function() {

        try {
            var microblog_body_sel = $('#channel .top input[name="microblog_body"]');

            // Keyboard event
            microblog_body_sel.keyup(function(e) {
                // Enter pressed: send the microblog notice
                if((e.keyCode == 13) && !Common.exists('#attach .wait')) {
                    return self.send();
                }
            });

            // Placeholder
            microblog_body_sel.placeholder();

            // Microblog file attacher
            self.attach();
        } catch(e) {
            Console.error('Microblog.instance', e);
        }

    };


    /**
     * Return class scope
     */
    return self;

})();
#!/bin/bash

#=================================================
# CHECKING
#=================================================

CHECK_PATH () {	# Vérifie la présence du / en début de path. Et son absence à la fin.
	if [ "${path:0:1}" != "/" ]; then    # Si le premier caractère n'est pas un /
		path="/$path"    # Ajoute un / en début de path
	fi
	if [ "${path:${#path}-1}" == "/" ] && [ ${#path} -gt 1 ]; then    # Si le dernier caractère est un / et que ce n'est pas le seul caractère.
		path="${path:0:${#path}-1}"	# Supprime le dernier caractère
	fi
}

CHECK_DOMAINPATH () {	# Vérifie la disponibilité du path et du domaine.
	sudo yunohost app checkurl $domain$path -a $app
}

CHECK_FINALPATH () {	# Vérifie que le dossier de destination n'est pas déjà utilisé.
	final_path=/var/www/$app
	test ! -e "$final_path" || ynh_die "This path already contains a folder"
}

#=================================================
# SETUP
#=================================================

SETUP_SOURCE () {	# Télécharge la source, décompresse et copie dans $final_path
	src_url=$(cat ../conf/app.src | grep SOURCE_URL | cut -d= -f2)
	src_checksum=$(cat ../conf/app.src | grep SOURCE_SUM | cut -d= -f2)
	# Download sources from the upstream
	wget -nv -O source.tar.gz $src_url
	# Vérifie la somme de contrôle de la source téléchargée.
	echo "$src_checksum source.tar.gz" | md5sum -c --status || ynh_die "Corrupt source"
	# Extract source into the app dir
	sudo mkdir -p $final_path
	sudo tar -x -f source.tar.gz -C $final_path --strip-components 1
	# Copie les fichiers additionnels ou modifiés.
	if test -e "../sources/ajouts"; then
		sudo cp -a ../sources/ajouts/. "$final_path"
	fi
}


#=================================================
# FUTUR YNH HELPERS
#=================================================
# Importer ce fichier de fonction avant celui des helpers officiel
# Ainsi, les officiels prendront le pas sur ceux-ci le cas échéant
#=================================================


# Exit if an error occurs during the execution of the script.
#
# Stop immediatly the execution if an error occured or if a empty variable is used.
# The execution of the script is derivate to ynh_exit_properly function before exit.
#
# Usage: ynh_check_error
ynh_check_error () {
	set -eu	# Exit if a command fail, and if a variable is used unset.
	trap ynh_exit_properly EXIT	# Capturing exit signals on shell script
}
